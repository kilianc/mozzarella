<div align="center">
  <br>
  <img src="./.github/mozzarella.png" width="500">
  <br>
  <br>
  <p>
    A cheezy-simple <b><code>1.3 kB</code></b> hook based <b><code>immutable store</code></b>, that leverages <b><code>useState</code></b> and <b><code>Immer</code></b> to create independent rendering trees so that your components <b>only re-render when they should</b>.
  </p>
  <div align="center">

![version](https://img.shields.io/npm/v/mozzarella?style=flat-square)
![size](https://img.shields.io/bundlephobia/minzip/mozzarella?style=flat-square)
![downloads](https://img.shields.io/npm/dm/mozzarella?style=flat-square)

  </div>
  <br>
</div>



## Motivation

I have been struggling to find a **state management** solution for `react` that makes you interact with your state using plain functions as a baseline. Most of the alternatives I found compromise simplicity, they're verbose or super abstract. I wanted an option that didn't force me to adopt a specific data pattern and was lean.

I don't like boilerplate code. It's the main reason why I stopped using `redux`, but I never stopped chasing most of its design goals. I love how in `redux`, components can be **built in isolation**, **tested easily**, and its overall **separation of concerns**.

While using some of the available `redux` alternatives, I kept asking myself:

* *"Where is the `connect` function?"*.
* *"How do I attach the state to my component without rewriting it?"*.

This led to many awkward implementations attempts, that ultimately fell short one way or another.

I also love **TypeScript**, and it has been hard to find a well balanced solution that satisfied all my requirements as well as having strong type support.

Last but not least: *your state management should be easy to understand for someone that didn't participate in the project design choices*.

### Design Goals

* [x] Be as simple as a **mozzarella** (duh!)
* [x] Use immutability without it getting in the way
* [x] Use plain JS functions as actions
* [x] Use async or sync functions for actions
* [x] Keep actions separated from the store
* [x] Prevent unnecessary re-rendering of components
* [x] Batch changes together to prevent race conditions
* [x] Batch changes across multiple stores
* [x] Lean and robust `TypeScript` support
* [x] Add dependencies checks (`react-hooks/exhaustive-deps`) for `useDerivedState` hook
* [x] Implement concurrency controls similar to [ember-concurrency](http://ember-concurrency.com/docs/task-concurrency)

## Install

    $ yarn add --exact mozzarella immer react-fast-compare

`immer`, `react` and `react-fast-compare` are peer dependencies — `mozzarella` uses whatever versions your app already has.

## Basic Example ([try it](https://codesandbox.io/s/mozzarella-basic-8og5b?file=/src/index.tsx))

```tsx
import { createRoot } from 'react-dom/client'
import { createStore } from 'mozzarella'

// create a store and pass an initial state

const { getState, createAction, useDerivedState } = createStore({
  names: ['kilian', 'arianna', 'antonia', 'pasquale'],
  places: ['san francisco', 'gavardo', 'salò']
})

// a Immer Draft<S> is passed to the action creator

const addName = createAction((state, name: string) => {
  state.names.push(name)
})

const addPlace = createAction((state, name: string) => {
  state.places.push(name)
})

// this component only re-renders when `state.names` changes

const Names = () => {
  console.info('<Names /> re-render')
  const names = useDerivedState(state => state.names)

  return (
    <div>
      <button onClick={() => addName('prison mike')}>Add Prison Mike</button>
      <button onClick={() => addPlace('scranton')}>Add Scranton</button>
      <h2>Names:</h2>
      <ul>
        {names.map((name, key) => (
          <li key={key}>{name}</li>
        ))}
      </ul>
      <h2>State:</h2>
      <pre>{JSON.stringify(getState(), null, 2)}</pre>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Names />)
```

## Example with pure functional components ([try it](https://codesandbox.io/s/mozzarella-fc-kwcvh?file=/src/index.tsx))

```tsx
// store.ts

import { createStore } from 'mozzarella'

export const { getState, createAction, useDerivedState } = createStore({
  fruits: []
})
```

```ts
// actions.ts

import { createAction } from './store'

export const addFruit = createAction((state, name: string) => {
  state.fruits.push(name)
})

export const popFruit = createAction((state) => {
  state.fruits.pop()
})
```

```tsx
// fruits.tsx

import React, { FC } from 'react'
import * as actions from './actions'
import { useDerivedState } from './store'

type FruitsProps = {
  fruits: string[]
  onRemove: () => void
  onAdd: (name: string) => void
}

// use this in your component stories and docs
export const Fruits = ({ fruits, onRemove, onAdd }: FruitsProps) => (
  <div>
    <h2>Fruits:</h2>
    <ul>
      {fruits.map((fruit, key) => (
        <li key={key}>{fruit}</li>
      ))}
    </ul>
    <button onClick={onRemove}>remove last fruit</button>
    <button onClick={() => onAdd('bananas')}>add bananas</button>
  </div>
)

// use this in your app rendering tree
Fruits.Connected = (() => {
  const derivedProps = useDerivedState((state) => ({
    fruits: state.fruits,
    onAdd: actions.addFruit,
    onRemove: actions.popFruit
  }))

  return <Fruits {...derivedProps} />
}) as FC
```

```tsx
// index.tsx

import { createRoot } from 'react-dom/client'
import { Fruit } from './fruit'

export const App = () => (
  <Fruit.Connected />
)

createRoot(document.getElementById('app')!).render(<App />)
```

## Batching

Every mutation made in the same tick is collected into a **single draft commit**. That holds across stores too: if two stores are touched in the same tick they commit together, so a selector that reads from both never sees a half applied batch.

```ts
const changeName = createAction((state, name: string) => {
  state.name = name
})

for (let i = 0; i < 100; i++) {
  // each iteration reuses the same state draft
  changeName(`name_${i}`)
}

// components subscribed to `state.name` will only re-render once.
// `state.name` will only be set once to "name_99"
```

An action commits on the microtask after its function settles, so an `async` action commits once it has fully resolved. If it throws, whatever it wrote up to that point is still committed and the returned promise rejects — a failing action never wedges the store.

## Concurrency

Actions accept an optional second argument that decides what happens when they're called again while already running. The modes mirror [ember-concurrency](http://ember-concurrency.com/docs/task-concurrency):

| mode | behaviour |
| ---- | --------- |
| `default` | every call runs, no limit |
| `drop` | calls made while at capacity are ignored |
| `restartable` | a new call cancels the running one |
| `enqueue` | calls made while at capacity wait for a free slot |
| `keepLatest` | like `enqueue`, but only the most recent waiting call is kept |

`maxConcurrency` (default `1`, or unbounded for `default`) sets how many runs may be in flight at once.

```tsx
import { createStore, getSignal, useIsRunning } from 'mozzarella'

const { createAction, useDerivedState } = createStore({
  query: '',
  results: [] as Result[]
})

const search = createAction(
  async (state, query: string) => {
    // pass the run's signal along and the request aborts when superseded
    const response = await fetch(`/search?q=${query}`, {
      signal: getSignal(state)
    })

    state.query = query
    state.results = await response.json()
  },
  { concurrency: 'restartable' }
)

const SearchBox = () => {
  const results = useDerivedState((state) => state.results)
  const isSearching = useIsRunning(search)

  return (
    <div>
      <input onChange={(event) => search(event.target.value)} />
      {isSearching ? <Spinner /> : <Results results={results} />}
    </div>
  )
}
```

A cancelled run can no longer write to the state, at any depth — the `state` it holds turns into a read-through view whose writes go nowhere. That makes `restartable` and `keepLatest` safe even when the underlying work isn't abortable. Passing `getSignal(state)` to `fetch` is still worth it: it stops the request instead of just discarding its result.

## Linting

`useDerivedState` takes a dependency list with the same rules as `useMemo`, so teach the React hooks plugin about it:

```js
// eslint.config.js
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  reactHooks.configs.flat.recommended,
  {
    rules: {
      'react-hooks/exhaustive-deps': [
        'error',
        { additionalHooks: '(useDerivedState)' }
      ]
    }
  }
]
```

## API Reference

### `createStore`

```ts
createStore <S extends object>(initialState: S) => {
  getState: () => S
  useDerivedState: <R>(selector: (state: S) => R, dependencies?: DependencyList) => R
  createAction: <U extends unknown[]>(actionFn: (state: Draft<S>, ...params: U) => void, options?: ActionOptions) => Action<U>
}
```

Takes the initial state as parameter and returns an object with three properties:

* [`getState`](#getState)
* [`createAction`](#createAction)
* [`useDerivedState`](#useDerivedState)

**Example**

```ts
type State = {
  users: Record<User>,
  photos: Record<Photo>,
  albums: Record<Album>,
  likes?: Record<Likes>
}

const { getState, createAction, useDerivedState } = createStore<State>({
  users: {},
  photos: {},
  albums: {}
})
```

---

### `getState`

```ts
const getState = () => S
```

Returns the instance of your immutable state

**Example**

```ts
const { likes } = getState()
```

---

### `createAction`

```ts
const createAction = <U extends unknown[]>(
  actionFn: (state: Draft<S>, ...params: U) => void,
  options?: ActionOptions
): Action<U>

type ActionOptions = {
  concurrency?: 'default' | 'drop' | 'restartable' | 'enqueue' | 'keepLatest'
  maxConcurrency?: number
}

type Action<U extends unknown[]> = {
  (...params: U): Promise<void>
  readonly isRunning: boolean
  readonly runningCount: number
  readonly pendingCount: number
  cancelAll(): void
  subscribe(listener: () => void): () => void
}
```

Takes a function as input and returns a *closured* **action** function that can manipulate a `Draft<S>` of your state. The returned promise resolves once the action's changes have been committed.

**Examples**


API call

```tsx
const login = createAction(async (state, email: string, password: string) => {
  const {
    err,
    userId,
    apiToken
  } = await apiRequest('/auth', { email, password })

  state.auth = {
    err,
    userId,
    apiToken
  }
})

// ...
<div>
  {auth.err ? <h1>Error: {err.message}</h1> : null}
  <button onClick={() => login('me@me.com', 'password')}>
    login
  </button>
</div>
// ...
```

Nested actions

```tsx
const fetchUsers = createAction(async (state, amount: number) => {
  const data = await apiRequest('https://url/data')

  data.users.forEach((user) => {
    state.users[user.id] = user
  })

  setPhotos(data.photos)
})

// actions that don't use a draft state directly, can be regular functions
const setPhotos = (photos: Photo[]) => {
  photos.forEach(setPhoto)
}

// actions that mutate the state draft, use `createAction`
const setPhoto = createAction((state, photo: Photo) => {
  // all mutations in the same tick, use the same draft
  // they only trigger a re-render once per tick
  state.photos[photo.id] = photo
})
```

Concurrency

```ts
// at most one save in flight; extra clicks are ignored
const save = createAction(async (state) => {
  await apiRequest('/save', { body: state.draft })
  state.savedAt = Date.now()
}, { concurrency: 'drop' })

save.isRunning     // false
save.runningCount  // 0
save.pendingCount  // 0
save.cancelAll()
```

---

### `useDerivedState`

```ts
const useDerivedState: <R>(selector: (state: S) => R, dependencies?: DependencyList) => R
```

Hook that given a **selector function**, will return the output of the selector and re-render the component only when it changes.

[As per usual](https://reactjs.org/docs/hooks-reference.html#usememo), this hook takes an optional `dependencies` parameter that defaults to `[]`. When the dependencies change the selector is re-evaluated immediately, so the value you get back is never a render behind.

**Example**

```tsx
const UserProfile = (props: { user: User, photos: Photo[] }) => {
  return (
    <div>
      <h1>User Profile: {props.user.username} ({props.photos.length} photos)</h1>
      <div>
        {props.photos.map((photo) => <Photo key={photo.id} photo={photo} />)}
      </div>
    </div>
  )
}

UserProfile.connected = (props: { userId: string }) => {
  const derivedProps = useDerivedState((state) => ({
    user: state.users[props.userId],
    photos: Object.values(state.photos).filter((photo) => photo.userId === props.userId)
  }), [props.userId])

  return <UserProfile {...derivedProps} />
}
```

Or if you're not being dogmatic about it, or simply not implementing a strict design system:

```tsx
const UserProfile = (props: { userId: string }) => {
  const { user, photos } = useDerivedState((state) => ({
    user: state.users[props.userId],
    photos: Object.values(state.photos).filter((photo) => photo.userId === props.userId)
  }), [props.userId])

  return (
    <div>
      <h1>User Profile: {user.username} ({photos.length} photos)</h1>
      <div>
        {photos.map((photo) => <Photo key={photo.id} photo={photo} />)}
      </div>
    </div>
  )
}
```

---

### `useIsRunning`

```ts
const useIsRunning: (...actions: RunnableAction[]) => boolean

type RunnableAction = {
  readonly isRunning: boolean
  subscribe(listener: () => void): () => void
}
```

Re-renders the component whenever any of the given actions starts or stops running.

**Example**

```tsx
const SaveButton = () => {
  const isSaving = useIsRunning(save, autoSave)

  return (
    <button onClick={() => save()} disabled={isSaving}>
      {isSaving ? 'Saving…' : 'Save'}
    </button>
  )
}
```

---

### `getSignal`

```ts
const getSignal: (state: Draft<S>) => AbortSignal
```

Returns the `AbortSignal` tied to the run that received `state`. It aborts when the run is cancelled, so hand it to `fetch` and anything else that takes one. Actions that don't opt into a concurrency mode get a signal that never aborts.

## Performance

Numbers below are produced by `yarn bench`, which measures the **published build** in `lib/` — not the TypeScript sources. `zustand` and `redux` appear as reference points; they make different trade-offs, so read the tables as "what does this design cost", not as a scoreboard.

#### Dispatch cost (no subscribers)

| store                              | ops/sec    | mean   | ± rme |
| ---------------------------------- | ---------- | ------ | ----- |
| mozzarella — action + immer commit | 1,553,045  | 731 ns | 1.2%  |
| zustand — setState                 | 22,304,278 | 49 ns  | 2.0%  |
| redux — dispatch                   | 20,084,805 | 71 ns  | 3.3%  |

One update, applied and settled. `mozzarella` pays for an Immer draft commit and a microtask hop; the other two mutate a plain object synchronously. This is the price of immutability plus batching, and it's paid once per tick rather than once per action — see the next table.

#### Batching 100 updates fired in a single tick

| store                                | batches/sec | mean     | per update | subscriber recomputations |
| ------------------------------------ | ----------- | -------- | ---------- | ------------------------- |
| mozzarella — 100 actions in one tick | 43,268      | 29.38 µs | 294 ns     | 1                         |
| zustand — 100 setState in one tick   | 400,504     | 2.94 µs  | 29 ns      | 100                       |

Batching is where the design pays for itself: a hundred actions produce **one** draft commit and **one** selector recomputation per subscriber, so derived work doesn't scale with how chatty your actions are.

#### Fan-out: one scoped update across 200 subscribed components

| store                                            | ops/sec | mean      | components re-rendered |
| ------------------------------------------------ | ------- | --------- | ---------------------- |
| mozzarella — 1 update, 200 subscribed components | 10,532  | 102.60 µs | 1 of 200               |
| zustand — 1 update, 200 subscribed components    | 12,365  | 88.35 µs  | 1 of 200               |

The claim on the tin: with 200 components subscribed to 200 different slices, changing one slice re-renders exactly one component. Wall-clock includes React committing the update inside `act()`, which both stores pay equally.

#### Bundle size

| imported           | minified | minified + gzipped |
| ------------------ | -------- | ------------------ |
| everything         | 3176 B   | 1480 B             |
| `createStore` only | 2802 B   | 1321 B             |

Peer dependencies excluded, bundled and minified with esbuild. The package is side-effect free, so an app that never touches `useIsRunning` doesn't ship it.

_Measured on Node 22.23.2 · React 19.2.8 · 18 cores · Linux arm64. Reproduce with `yarn bench`._

## How to contribute

Contributions and bug fixes from the community are welcome. You can run the test suite locally with:

    $ yarn lint
    $ yarn test
    $ yarn bench

If you'd rather not install a Node toolchain on your machine, the repo ships a pinned one in `tools/Dockerfile`. Prefix any command with `bin/tools` to run it inside that image:

    $ bin/tools yarn install
    $ bin/tools yarn test

## License

This software is released under the MIT license cited below.

    Copyright (c) 2020 Kilian Ciuffolo, me@nailik.org. All Rights Reserved.

    Permission is hereby granted, free of charge, to any person
    obtaining a copy of this software and associated documentation
    files (the 'Software'), to deal in the Software without
    restriction, including without limitation the rights to use,
    copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the
    Software is furnished to do so, subject to the following
    conditions:

    The above copyright notice and this permission notice shall be
    included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
    OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
    HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
    WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
    OTHER DEALINGS IN THE SOFTWARE.
