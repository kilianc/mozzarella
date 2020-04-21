<div align="center">
  <br>
  <img src="./.github/mozzarella.png" width="500">
  <br>
  <br>
  <p>
    A cheezy-simple <b><code>679 bytes</code></b> hook based <b><code>immutable store</code></b>, that leverages <b><code>useState</code></b> and <b><code>Immer</code></b> to create independent rendering trees, so that your components <b>only re-render when they should</b>.
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

I don't like boilerplate code. It's the main reason why I stopped using `redux`, but I never stopped chasing most of its design goals. I love how in `redux`, components can be **built in isolation**, **tested easily** and its overall **separation of concerns**.

While using some of the available `redux` alternatives, I kept asking myself:

* *"Where is the `connect` function?"*.
* *"How do I attach the state to my component without rewriting it?"*.

This led to many awkward implementations attempts, that ultimately fell short one way or another.

I also love **TypeScript**, and it has been hard to find a well balanced solution that satisfied all my requirements as well as having a strong type support.

Last but not least: *your state management should be easy to understand for someone that didn't participate in the project design choices*.

### Design Goals

* [x] Be as simple as a **mozzarella** (duh!)
* [x] Use immutability without it getting in the way
* [x] Use plain JS functions as actions
* [x] Use async or sync functions for actions
* [x] Keep actions separated from the store
* [x] Prevent unnecessary re-rendering of components
* [x] Batch changes together to prevent race conditions
* [ ] Batch changes across multiple stores
* [x] Lean and robust `TypeScript` support
* [ ] Add dependencies checks (`react-hooks/exhaustive-deps`) for `useDerivedState` hook
* [ ] Implement concurrency controls similar to [ember-concurrency](http://ember-concurrency.com/docs/task-concurrency)

## Install

    $ yarn add --dev --exact mozzarella

## Demos 👩‍💻

> Coming soon

## Basic Example ([try it]())

```tsx
import React from 'react'
import ReactDOM from 'react-dom'
import { createStore } from './mozzarella'

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

ReactDOM.render(<Names />, document.getElementById('root'))
```

## Example with pure functional components ([try it]())

```tsx
// store.ts

import { createStore } from 'react-create-store'

export const { getState, createAction, useDerivedState } = createStore({
  names: ['kilian', 'arianna', 'antonia', 'pasquale'],
  places: ['san francisco', 'gavardo', 'salò']
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

import { FC } from 'react'
import { actions } from './actions'

type FruitsProps = {
  fruits: string[]
  onRemove: () => void
  onAdd: (name: string) => void
}

// use this in your component stories and docs
export const Fruits: FC<FruitsProps> = ({ fruits }) => (
  <div>
    <h2>Fruits:</h2>
    <ul>
      {names.map((name, key) => <li key={key}>{name}</li>)}
    </ul>
    <button onClick={onRemove}>remove last fruit</button>
    <button onClick={() => onAdd('bananas')}>add bananas</button>
  </div>
)

// use this in your app rendering tree
Fruits.Connected = () => {
  const derivedProps = useDerivedState((state) => {
    fruits: state.fruits,
    onAdd: actions.onAdd,
    onRemove: actions.popFruit
  })

  return <Fruits {...derivedProps} />
}
```

```tsx
// index.tsx

import React from 'react'
import ReactDOM from 'react-dom'
import { Fruit } from './fruit'

export const App = () => (
  <Fruit.Connected />
)

ReactDOM.render(<App />, document.getElementById('app'))
```

## API Reference

### `createStore`

```ts
createStore <S>(initialState: S) => {
  getState: () => S
  useDerivedState: <R>(selector: (state: S) => R) => R
  createAction: <U extends unknown[]>(actionFn: (state: Draft<S>, ...params: U) => void) => (...params: U) => void
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
const createAction = <U extends unknown[]>(actionFn: (state: Draft<S>, ...params: U) => void): (...params: U) => void
```

Takes a function as input and returns a *closured* **action** function that can manipulate a `Draft<S>` of your state.

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

Batching state changes

```tsx
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

---

### `useDerivedState`

```ts
const useDerivedState: <R>(selector: (state: S) => R, dependencies?: DependencyList) => R
```

Hook that given a **selector function**, will return the output of the selector and re-render the component only when it changes.

[As per usual](https://reactjs.org/docs/hooks-reference.html#usememo), this hook takes an optional `dependencies` parameter `that defaults to `[]`.

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
  const derivedProps = useDerivedState((state) => {
    user: state.users[props.userId],
    photos: Object.values(state.photos).filter((photo) => photo.userId === props.userId)
  }, [props.userId])

  return <UserProfile {...derivedProps} />
}
```

Or if you're not being dogmatic about it, or simply not implementing a strict design system:

```tsx
const UserProfile = (props: { userId: string }) => {
  const { user, photos } = useDerivedState((state) => {
    user: state.users[props.userId],
    photos: Object.values(state.photos).filter((photo) => photo.userId === props.userId)
  }, [props.userId])

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

## How to contribute

Contributions and bug fixes from the community are welcome. You can run the test suite locally with:

    $ yarn lint
    $ yarn test

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
