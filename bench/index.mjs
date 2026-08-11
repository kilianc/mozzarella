// Benchmarks for mozzarella. Run with `yarn bench` (builds first).
//
// Everything here measures the *published* build in `lib/esm`, never the
// TypeScript sources, so the numbers reflect what a consumer actually installs.
import os from 'node:os'
import { gzipSync } from 'node:zlib'

import { Bench } from 'tinybench'
import * as esbuild from 'esbuild'

import { installDom, formatMs, formatOps, table } from './harness.mjs'

installDom()

// Imported after the DOM exists — React reads it at module scope.
const React = (await import('react')).default
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createStore } = await import('../lib/esm/index.js')
const { createStore: createZustandStore } = await import('zustand/vanilla')
const { useStore: useZustandStore } = await import('zustand')
const { createStore: createReduxStore } = await import('redux')

const SLICES = 200
const BATCH = 100
const BENCH_OPTIONS = { time: 300, warmupTime: 100 }

const sections = []

const section = (title, note, headers, rows) => {
  sections.push({ title, note, body: table(headers, rows) })
}

// ---------------------------------------------------------------------------
// 1. Dispatch cost — how long a single update takes to apply and settle.
// ---------------------------------------------------------------------------

const benchDispatch = async () => {
  const mozzarella = createStore({ count: 0 })
  const bump = mozzarella.createAction((state) => {
    state.count++
  })

  const zustand = createZustandStore(() => ({ count: 0 }))
  const redux = createReduxStore((state = { count: 0 }) => ({
    count: state.count + 1
  }))

  const bench = new Bench(BENCH_OPTIONS)

  bench
    .add('mozzarella — action + immer commit', async () => {
      await bump()
    })
    .add('zustand — setState', () => {
      zustand.setState((state) => ({ count: state.count + 1 }))
    })
    .add('redux — dispatch', () => {
      redux.dispatch({ type: 'inc' })
    })

  await bench.run()

  section(
    'Dispatch cost (no subscribers)',
    'One update, applied and settled. mozzarella pays for an Immer draft commit and a microtask hop; the other two mutate a plain object synchronously. Different guarantees — read it as the price of immutability, not as a ranking.',
    ['store', 'ops/sec', 'mean', '± rme'],
    bench.tasks.map((task) => [
      task.name,
      formatOps(task.result.throughput.mean),
      formatMs(task.result.latency.mean),
      `${task.result.latency.rme.toFixed(1)}%`
    ])
  )
}

// ---------------------------------------------------------------------------
// 2. Batching — how much work K updates in one tick cost.
// ---------------------------------------------------------------------------

const benchBatching = async () => {
  let mozzarellaSelectorRuns = 0
  const mozzarella = createStore({ count: 0 })
  const bump = mozzarella.createAction((state) => {
    state.count++
  })

  let zustandSelectorRuns = 0
  const zustand = createZustandStore(() => ({ count: 0 }))

  const bench = new Bench(BENCH_OPTIONS)

  bench
    .add(`mozzarella — ${BATCH} actions in one tick`, async () => {
      let last
      for (let i = 0; i < BATCH; i++) last = bump()
      await last
    })
    .add(`zustand — ${BATCH} setState in one tick`, () => {
      for (let i = 0; i < BATCH; i++) {
        zustand.setState((state) => ({ count: state.count + 1 }))
      }
    })

  await bench.run()

  // Count how often a subscriber's selector is asked to recompute for a batch
  // of BATCH updates. This is the number that decides how much derived work an
  // app repeats, independently of how fast a single dispatch is.
  const countingStore = createStore({ count: 0 })
  const countingBump = countingStore.createAction((state) => {
    state.count++
  })

  const zustandCounting = createZustandStore(() => ({ count: 0 }))
  zustandCounting.subscribe(() => {
    zustandSelectorRuns++
  })

  const Counter = () => {
    return React.createElement(
      'span',
      null,
      countingStore.useDerivedState((state) => {
        mozzarellaSelectorRuns++
        return state.count
      })
    )
  }

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(React.createElement(Counter))
  })

  mozzarellaSelectorRuns = 0

  await act(async () => {
    let last
    for (let i = 0; i < BATCH; i++) last = countingBump()
    await last
  })

  for (let i = 0; i < BATCH; i++) {
    zustandCounting.setState((state) => ({ count: state.count + 1 }))
  }

  await act(async () => {
    root.unmount()
  })

  section(
    `Batching ${BATCH} updates fired in a single tick`,
    'mozzarella collapses every mutation made in the same tick into one draft commit, so subscribers recompute once no matter how many actions ran. Amortised over a batch, an action costs a fraction of a lone awaited dispatch.',
    ['store', 'batches/sec', 'mean', 'per update', 'subscriber recomputations'],
    [
      [
        bench.tasks[0].name,
        formatOps(bench.tasks[0].result.throughput.mean),
        formatMs(bench.tasks[0].result.latency.mean),
        formatMs(bench.tasks[0].result.latency.mean / BATCH),
        String(mozzarellaSelectorRuns)
      ],
      [
        bench.tasks[1].name,
        formatOps(bench.tasks[1].result.throughput.mean),
        formatMs(bench.tasks[1].result.latency.mean),
        formatMs(bench.tasks[1].result.latency.mean / BATCH),
        String(zustandSelectorRuns)
      ]
    ]
  )
}

// ---------------------------------------------------------------------------
// 3. Fan-out — one update against many subscribed components.
// ---------------------------------------------------------------------------

const renderMozzarellaTree = async () => {
  const store = createStore({
    slices: Array.from({ length: SLICES }, () => 0)
  })

  const touch = store.createAction((state, index) => {
    state.slices[index]++
  })

  let renders = 0

  const Slice = ({ index }) => {
    renders++
    const value = store.useDerivedState((state) => state.slices[index])
    return React.createElement('span', null, value)
  }

  const Tree = () =>
    React.createElement(
      'div',
      null,
      Array.from({ length: SLICES }, (_, index) =>
        React.createElement(Slice, { key: index, index })
      )
    )

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(React.createElement(Tree))
  })

  return {
    update: async (index) => {
      await act(async () => {
        await touch(index)
      })
    },
    renders: () => renders,
    reset: () => {
      renders = 0
    },
    unmount: () => act(async () => root.unmount())
  }
}

const renderZustandTree = async () => {
  const store = createZustandStore(() => ({
    slices: Array.from({ length: SLICES }, () => 0)
  }))

  let renders = 0

  const Slice = ({ index }) => {
    renders++
    const value = useZustandStore(store, (state) => state.slices[index])
    return React.createElement('span', null, value)
  }

  const Tree = () =>
    React.createElement(
      'div',
      null,
      Array.from({ length: SLICES }, (_, index) =>
        React.createElement(Slice, { key: index, index })
      )
    )

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(React.createElement(Tree))
  })

  return {
    update: async (index) => {
      await act(async () => {
        store.setState((state) => ({
          slices: state.slices.map((value, i) =>
            i === index ? value + 1 : value
          )
        }))
      })
    },
    renders: () => renders,
    reset: () => {
      renders = 0
    },
    unmount: () => act(async () => root.unmount())
  }
}

const benchFanOut = async () => {
  const mozzarella = await renderMozzarellaTree()
  const zustand = await renderZustandTree()

  // Re-render accounting for a single scoped update.
  mozzarella.reset()
  await mozzarella.update(7)
  const mozzarellaRenders = mozzarella.renders()

  zustand.reset()
  await zustand.update(7)
  const zustandRenders = zustand.renders()

  let index = 0
  const bench = new Bench(BENCH_OPTIONS)

  bench
    .add(`mozzarella — 1 update, ${SLICES} subscribed components`, async () => {
      await mozzarella.update(index++ % SLICES)
    })
    .add(`zustand — 1 update, ${SLICES} subscribed components`, async () => {
      await zustand.update(index++ % SLICES)
    })

  await bench.run()

  await mozzarella.unmount()
  await zustand.unmount()

  section(
    `Fan-out: one scoped update across ${SLICES} subscribed components`,
    'Only the component whose slice changed should re-render. Wall-clock includes React committing the update inside `act()`, which both stores pay equally.',
    ['store', 'ops/sec', 'mean', 'components re-rendered'],
    [
      [
        bench.tasks[0].name,
        formatOps(bench.tasks[0].result.throughput.mean),
        formatMs(bench.tasks[0].result.latency.mean),
        `${mozzarellaRenders} of ${SLICES}`
      ],
      [
        bench.tasks[1].name,
        formatOps(bench.tasks[1].result.throughput.mean),
        formatMs(bench.tasks[1].result.latency.mean),
        `${zustandRenders} of ${SLICES}`
      ]
    ]
  )
}

// ---------------------------------------------------------------------------
// 4. Bundle size — mozzarella's own code, peers excluded.
// ---------------------------------------------------------------------------

const measure = async (contents) => {
  const build = await esbuild.build({
    stdin: { contents, resolveDir: process.cwd(), loader: 'js' },
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2020',
    // `react`, `immer` and `react-fast-compare` are peer dependencies, so they
    // are not part of what mozzarella adds to a bundle.
    external: ['react', 'immer', 'react-fast-compare'],
    write: false
  })

  const minified = build.outputFiles[0].contents

  return [`${minified.length} B`, `${gzipSync(minified).length} B`]
}

const benchSize = async () => {
  const everything = `
    import * as mozzarella from './lib/esm/index.js'
    console.log(mozzarella)
  `

  const storeOnly = `
    import { createStore } from './lib/esm/index.js'
    console.log(createStore)
  `

  section(
    'Bundle size',
    "Peer dependencies excluded, bundled and minified with esbuild. The package is side-effect free, so an app that never touches `useIsRunning` doesn't ship it.",
    ['imported', 'minified', 'minified + gzipped'],
    [
      ['everything', ...(await measure(everything))],
      ['`createStore` only', ...(await measure(storeOnly))]
    ]
  )
}

// ---------------------------------------------------------------------------

const main = async () => {
  await benchDispatch()
  await benchBatching()
  await benchFanOut()
  await benchSize()

  const cpu = os.cpus()[0].model.trim()
  const environment = [
    `Node ${process.versions.node}`,
    `React ${React.version}`,
    ...(cpu && cpu !== 'unknown' ? [cpu] : []),
    `${os.cpus().length} cores`,
    `${os.type()} ${os.arch()}`
  ].join(' · ')

  const output = [
    ...sections.flatMap(({ title, note, body }) => [
      `#### ${title}`,
      '',
      body,
      '',
      note,
      ''
    ]),
    `_Measured on ${environment}. Reproduce with \`yarn bench\`._`
  ].join('\n')

  console.log(output)
}

await main()
