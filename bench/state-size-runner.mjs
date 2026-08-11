// One state size, one variant, one process. Spawned by `bench/index.mjs`.
//
// Measuring the sizes in a single process makes the later rounds look slower
// than they are: a 2000-entry state churns enough garbage that the collector,
// not the store, ends up being measured. A fresh process per data point keeps
// the heap comparable across sizes.
import { createStore } from '../lib/esm/index.js'

const SIZE = Number(process.env.SIZE)
const VARIANT = process.env.VARIANT
const SAMPLES = Number(process.env.SAMPLES || 20000)
const WARMUP = Number(process.env.WARMUP || 2000)

const makeItems = () =>
  Object.fromEntries(
    Array.from({ length: SIZE }, (_, index) => [index, { id: index, value: 0 }])
  )

const time = async (update) => {
  for (let i = 0; i < WARMUP; i++) await update(i % SIZE)

  const started = process.hrtime.bigint()
  for (let i = 0; i < SAMPLES; i++) await update(i % SIZE)

  return Number(process.hrtime.bigint() - started) / 1e6 / SAMPLES
}

const variants = {
  // What an app gets from mozzarella in production.
  mozzarella: () => {
    const store = createStore({ items: makeItems() }, { freeze: false })
    return store.createAction((state, id) => {
      state.items[id].value++
    })
  },
  // The same store with Immer's auto-freeze left on.
  frozen: () => {
    const store = createStore({ items: makeItems() }, { freeze: true })
    return store.createAction((state, id) => {
      state.items[id].value++
    })
  },
  // The equivalent update written by hand: copy the container, copy the one
  // entry that changed, share the rest. This is what a `zustand` or `redux`
  // reducer does for the same edit.
  spread: () => {
    let state = { items: makeItems() }

    return (id) => {
      state = {
        items: {
          ...state.items,
          [id]: { ...state.items[id], value: state.items[id].value + 1 }
        }
      }
    }
  }
}

const ms = await time(variants[VARIANT]())

console.log(JSON.stringify({ size: SIZE, variant: VARIANT, ms }))
