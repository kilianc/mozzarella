import { useState } from 'react'
import { render, renderHook, act, screen } from '@testing-library/react'
import { produce } from 'immer'

import { createStore } from './create-store.js'
import { getSignal } from './concurrency.js'
import { useIsRunning } from './use-is-running.js'

type Deferred = {
  promise: Promise<void>
  resolve: () => void
  reject: (error: unknown) => void
}

const deferred = (): Deferred => {
  let resolve: () => void = () => undefined
  let reject: (error: unknown) => void = () => undefined

  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

/** Lets every already queued microtask run. */
const flush = () => act(async () => undefined)

const noop = () => undefined

test('should correctly create a store', () => {
  const store = createStore({
    pizza: 'ya',
    pasta: 'yas',
    mozzarella: 'yas!'
  })

  expect(store.getState).toBeDefined()
  expect(store.useDerivedState).toBeDefined()
  expect(store.createAction).toBeDefined()
})

test('should re-render components only when the selected state changes', async () => {
  const { getState, createAction, useDerivedState } = createStore({
    colors: ['green', 'white', 'red'],
    cities: ['brescia', 'roma', 'firenze']
  })

  const addColor = createAction((state, color: string) => {
    state.colors.push(color)
  })

  const addCity = createAction((state, city: string) => {
    state.cities.push(city)
  })

  let count = 0
  const { result } = renderHook(() => {
    count++
    return useDerivedState((state) => state.colors)
  })

  expect(count).toBe(1)
  expect(result.current).toEqual(['green', 'white', 'red'])
  expect(getState()).toEqual({
    colors: ['green', 'white', 'red'],
    cities: ['brescia', 'roma', 'firenze']
  })

  await act(() => addColor('blue'))

  expect(count).toBe(2)
  expect(result.current).toEqual(['green', 'white', 'red', 'blue'])
  expect(getState()).toEqual({
    colors: ['green', 'white', 'red', 'blue'],
    cities: ['brescia', 'roma', 'firenze']
  })

  await act(() => addCity('venezia'))

  expect(count).toBe(2)
  expect(result.current).toEqual(['green', 'white', 'red', 'blue'])
  expect(getState()).toEqual({
    colors: ['green', 'white', 'red', 'blue'],
    cities: ['brescia', 'roma', 'firenze', 'venezia']
  })
})

test('should batch draft commits once per tick', async () => {
  const { createAction, useDerivedState } = createStore({
    answer: 0
  })

  const findAnswer = createAction(async (state) => {
    state.answer++
  })

  let count = 0
  const { result } = renderHook(() => {
    return useDerivedState((state) => {
      count++
      return state.answer
    })
  })

  await act(async () => {
    for (let i = 0; i < 5; i++) {
      findAnswer()
    }
  })

  // Once on mount, once for the single commit the five calls were batched into.
  expect(count).toBe(2)
  expect(result.current).toBe(5)
})

test('should batch commits across multiple stores', async () => {
  const left = createStore({ value: 0 })
  const right = createStore({ value: 0 })

  const bumpLeft = left.createAction((state) => {
    state.value++
  })

  const bumpRight = right.createAction((state) => {
    state.value++
  })

  let count = 0
  renderHook(() => {
    count++
    // A selector that reads from both stores must never see a half applied
    // batch: whenever the two stores are bumped together they stay in sync.
    const leftValue = left.useDerivedState((state) => state.value)
    const rightValue = right.useDerivedState((state) => state.value)

    expect(leftValue).toBe(rightValue)

    return leftValue + rightValue
  })

  expect(count).toBe(1)

  await act(async () => {
    bumpLeft()
    bumpRight()
  })

  // Both stores committed in the same flush, so React only re-rendered once.
  expect(count).toBe(2)
  expect(left.getState().value).toBe(1)
  expect(right.getState().value).toBe(1)
})

test('should work with async actions', async () => {
  type State = {
    books: Array<{
      title: string
      rating?: number
    }>
  }

  const { createAction, useDerivedState } = createStore<State>({
    books: [
      {
        title: 'children of time',
        rating: 3
      }
    ]
  })

  const addBook = createAction(async (state) => {
    state.books.push({
      title: 'children of ruin'
    })

    const rating1 = await new Promise<number>((resolve) =>
      setTimeout(() => resolve(4.5), 100)
    )

    const rating2 = await new Promise<number>((resolve) =>
      setTimeout(() => resolve(4), 100)
    )

    state.books[0].rating = rating1
    state.books[1].rating = rating2
  })

  const { result } = renderHook(() => useDerivedState((state) => state.books))

  await act(() => addBook())

  expect(result.current).toEqual([
    {
      title: 'children of time',
      rating: 4.5
    },
    {
      title: 'children of ruin',
      rating: 4
    }
  ])
})

test('should correctly handle when the hook deps change', async () => {
  const { useDerivedState } = createStore({ value: 10 })

  let count = 0
  const { result } = renderHook(() => {
    const [foo, setFoo] = useState(0)
    const [baseValue, setBaseValue] = useState(0)

    const derived = useDerivedState(
      (state) => {
        count++
        return state.value + baseValue
      },
      [baseValue]
    )

    if (foo === 0) setFoo(10)
    if (baseValue === 0) setBaseValue(1)
    if (baseValue === 1) setBaseValue(2)
    if (baseValue === 2) setBaseValue(3)

    return derived
  })

  // One evaluation per distinct dependency list, and the returned value tracks
  // the latest one instead of lagging a render behind.
  expect(count).toBe(4)
  expect(result.current).toBe(13)
})

test('should update every component sharing the same selector function', async () => {
  const { createAction, useDerivedState } = createStore({
    colors: ['green']
  })

  const selectColors = (state: { colors: string[] }) => state.colors

  const addColor = createAction((state, color: string) => {
    state.colors.push(color)
  })

  const Colors = ({ name }: { name: string }) => {
    const colors = useDerivedState(selectColors)
    return <div data-testid={name}>{colors.join(',')}</div>
  }

  render(
    <>
      <Colors name="one" />
      <Colors name="two" />
    </>
  )

  await act(() => addColor('white'))

  expect(screen.getByTestId('one').textContent).toBe('green,white')
  expect(screen.getByTestId('two').textContent).toBe('green,white')
})

test('should stop notifying selectors once the component unmounts', async () => {
  const { createAction, useDerivedState } = createStore({ value: 0 })

  const bump = createAction((state) => {
    state.value++
  })

  let count = 0
  const { unmount } = renderHook(() =>
    useDerivedState((state) => {
      count++
      return state.value
    })
  )

  await act(() => bump())
  expect(count).toBe(2)

  unmount()

  await act(() => bump())
  expect(count).toBe(2)
})

test('should commit and release the store when an action throws', async () => {
  const { getState, createAction } = createStore({ value: 0, failed: false })

  const boom = createAction((state) => {
    state.failed = true
    throw new Error('boom')
  })

  const bump = createAction((state) => {
    state.value++
  })

  await expect(boom()).rejects.toThrow('boom')
  expect(getState().failed).toBe(true)

  // A throw must not wedge the scheduler for everything that comes after it.
  await bump()
  expect(getState().value).toBe(1)
})

describe('freezing', () => {
  test('`freeze: true` freezes what a commit produces', async () => {
    const { getState, createAction } = createStore(
      { items: [{ value: 0 }] },
      { freeze: true }
    )

    const bump = createAction((state) => {
      state.items[0].value++
    })

    await bump()

    const state = getState()

    expect(Object.isFrozen(state.items)).toBe(true)
    expect(Object.isFrozen(state.items[0])).toBe(true)
    expect(() => {
      state.items[0].value = 99
    }).toThrow()
  })

  test('`freeze: false` leaves committed state unfrozen but still correct', async () => {
    const { getState, createAction } = createStore(
      { items: [{ value: 0 }] },
      { freeze: false }
    )

    const bump = createAction((state) => {
      state.items[0].value++
    })

    const before = getState()

    await bump()
    await bump()

    const after = getState()

    expect(after.items[0].value).toBe(2)
    expect(Object.isFrozen(after.items)).toBe(false)
    // Not freezing must not cost the structural sharing the store relies on to
    // decide what changed.
    expect(after).not.toBe(before)
    expect(before.items[0].value).toBe(0)
  })

  test('a store never changes how the app`s own immer behaves', async () => {
    const { createAction } = createStore({ value: 0 }, { freeze: false })

    await createAction((state) => {
      state.value++
    })()

    // The store holds a private Immer instance, so opting out of freezing must
    // not reach the global one every app already shares.
    expect(Object.isFrozen(produce({ nested: {} }, noop).nested)).toBe(true)
  })
})

describe('concurrency', () => {
  test('`drop` ignores calls made while the action is running', async () => {
    const { getState, createAction } = createStore({ count: 0 })
    const gate = deferred()

    const run = createAction(
      async (state) => {
        state.count++
        await gate.promise
      },
      { concurrency: 'drop' }
    )

    const first = run()
    await run()

    expect(run.runningCount).toBe(1)

    gate.resolve()
    await first

    expect(getState().count).toBe(1)
    expect(run.isRunning).toBe(false)
  })

  test('`restartable` cancels the running call and discards its writes', async () => {
    type State = { query: string; results: string[] }

    const { getState, createAction } = createStore<State>({
      query: '',
      results: []
    })

    const gates = [deferred(), deferred()]
    const signals: AbortSignal[] = []
    let index = 0

    const search = createAction(
      async (state, query: string) => {
        const gate = gates[index++]
        signals.push(getSignal(state))

        await gate.promise

        state.query = query
        state.results.push(query)
      },
      { concurrency: 'restartable' }
    )

    const first = search('a')
    const second = search('b')

    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)

    gates[0].resolve()
    gates[1].resolve()
    await Promise.all([first, second])

    // Neither the top level assignment nor the nested push from the cancelled
    // run made it into the committed state.
    expect(getState()).toEqual({ query: 'b', results: ['b'] })
  })

  test('`enqueue` runs calls one after another', async () => {
    const { getState, createAction } = createStore<{ order: string[] }>({
      order: []
    })

    const gates: Record<string, Deferred> = {
      a: deferred(),
      b: deferred()
    }

    const append = createAction(
      async (state, name: string) => {
        await gates[name].promise
        state.order.push(name)
      },
      { concurrency: 'enqueue' }
    )

    const first = append('a')
    const second = append('b')

    expect(append.runningCount).toBe(1)
    expect(append.pendingCount).toBe(1)

    // `b` has not started yet, so resolving its gate changes nothing.
    gates.b.resolve()
    await flush()
    expect(getState().order).toEqual([])

    gates.a.resolve()
    await Promise.all([first, second])

    expect(getState().order).toEqual(['a', 'b'])
    expect(append.pendingCount).toBe(0)
  })

  test('`keepLatest` only keeps the most recent waiting call', async () => {
    const { getState, createAction } = createStore<{ order: string[] }>({
      order: []
    })

    const gate = deferred()
    let started = 0

    const append = createAction(
      async (state, name: string) => {
        if (started++ === 0) await gate.promise
        state.order.push(name)
      },
      { concurrency: 'keepLatest' }
    )

    const first = append('a')
    const dropped = append('b')
    const kept = append('c')

    expect(append.pendingCount).toBe(1)

    gate.resolve()
    await Promise.all([first, dropped, kept])

    expect(getState().order).toEqual(['a', 'c'])
  })

  test('`maxConcurrency` caps how many runs are in flight', async () => {
    const { createAction } = createStore<{ done: number }>({ done: 0 })

    const gate = deferred()

    const run = createAction(
      async (state) => {
        await gate.promise
        state.done++
      },
      { concurrency: 'enqueue', maxConcurrency: 2 }
    )

    const all = [run(), run(), run()]

    expect(run.runningCount).toBe(2)
    expect(run.pendingCount).toBe(1)

    gate.resolve()
    await Promise.all(all)

    expect(run.runningCount).toBe(0)
  })

  test('`cancelAll` stops running calls and clears the queue', async () => {
    const { getState, createAction } = createStore({ value: 0 })

    const gate = deferred()

    const run = createAction(
      async (state) => {
        await gate.promise
        state.value++
      },
      { concurrency: 'enqueue' }
    )

    const first = run()
    const second = run()

    run.cancelAll()

    expect(run.isRunning).toBe(false)
    expect(run.pendingCount).toBe(0)

    gate.resolve()
    await Promise.all([first, second])

    expect(getState().value).toBe(0)
  })

  test('`cancelAll` releases the slots of a running default action', async () => {
    const { getState, createAction } = createStore({ value: 0 })

    const gate = deferred()

    const run = createAction(async (state) => {
      await gate.promise
      state.value++
    })

    const first = run()
    const second = run()

    expect(run.runningCount).toBe(2)

    run.cancelAll()

    expect(run.isRunning).toBe(false)
    expect(run.runningCount).toBe(0)

    gate.resolve()
    await Promise.all([first, second])

    // Both runs settle after `cancelAll` already released their slots, which
    // must not push the count below zero.
    expect(run.runningCount).toBe(0)

    // A default action holds nothing that could stop it, so `cancelAll` frees
    // the slot but the writes still land — unlike a cancellable mode.
    expect(getState().value).toBe(2)

    await run()

    expect(run.runningCount).toBe(0)
    expect(getState().value).toBe(3)
  })

  test('actions without a concurrency mode get a signal that never aborts', async () => {
    const { createAction } = createStore({ value: 0 })

    let signal: AbortSignal | undefined

    const run = createAction((state) => {
      signal = getSignal(state)
      state.value++
    })

    await run()

    expect(signal?.aborted).toBe(false)
  })

  test('useIsRunning tracks the action across renders', async () => {
    const { createAction } = createStore({ value: 0 })

    const gate = deferred()

    const save = createAction(
      async (state) => {
        await gate.promise
        state.value++
      },
      { concurrency: 'drop' }
    )

    const { result } = renderHook(() => useIsRunning(save))

    expect(result.current).toBe(false)

    await act(async () => {
      save()
    })

    expect(result.current).toBe(true)

    await act(async () => {
      gate.resolve()
      await flush()
    })

    expect(result.current).toBe(false)
  })
})
