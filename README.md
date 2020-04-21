# `selectore`

* ~~grocery-store~~
* ~~carpaccio~~
* ~~restoreant~~
* mortadella
* flower-store
* hook-store
* store-hook
* pa-store
* superstore


A **`60LOC`** hook based **immutable store**, with **actions** and **selector based subscriptions**<br>

**Selectore** leverages `useState` and `Immer` to create independent rendering trees, so that your components only re-render when their dependencies change.

## Demos

CodeSandbox demos

## Install

    $ yarn add --dev --exact selector

## Usage


`select` the part of your global state that your component needs and **only re-render when the selected state changes**.

```tsx
import { createStore } from 'selectore'

// create a store and pass an initial state
const { getState, createAction, useStoreSelector } = createStore({
  names: ['kilian', 'hassan', 'juliet'],
  places: ['san francisco', 'salò', 'lebanon']
})

// calling `addName` will trigger a re-render
const addName = createAction((state, name: string) => {
  state.names.push(name)
})

// calling `addPlace` will not trigger a re-render
const addPlace = createAction((state, name: string) => {
  state.places.push(name)
})

const Names = () => {
  // this component will only re-render when `state.names` changes
  const names = useStoreSelector((state) => state.names)
  return names.map((name, key) => <span key={key}>{name}</span>)
}
```

## How it works

This library allows you to use a *"subscribe through selectors"* approach, to connect your components to the store.

The implementation is very simple ([60LOC](src/create-store.ts)) and all it does is run all the selectors used by your components and determine when to call `setState` to trigger a re-render.

## Example with pure functional components

```tsx
// store.ts

import { createStore } from 'react-create-store'

export const { getState, createAction, useStoreSelector } = createStore({
  names: ['kilian', 'hassan', 'juliet'],
  places: ['san francisco', 'salò', 'lebanon']
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

export const ConnectedFruits = () => {
  const props = useStoreSelector((state) => {
    fruits: state.fruits,
    onAdd: actions.onAdd,
    onRemove: actions.popFruit
  })

  return <Fruits {...props}>
}
```

```tsx
// index.tsx

import React from 'react'
import ReactDOM from 'react-dom'
import { ConnectedFruits as Fruit } from './fruit'

export const App = () => (
  <Fruit/>
)

ReactDOM.render(<App />, document.getElementById('app'))
```

## API Reference

### `createStore`

```ts
createStore <S>(initialState: S) => {
  getState: () => S;
  useStoreSelector: <R>(selector: (state: S) => R) => R;
  createAction: <U extends unknown[]>(actionFn: (state: Draft<S>, ...params: U) => void) => (...params: U) => void;
}
```

Takes the initial state as parameter and returns an object with three properties:

* [`getState`](#getState)
* [`createAction`](#createAction)
* [`useStoreSelector`](#useStoreSelector)

### `getState`

```ts
const getState = () => S;
```

Returns the instance of your immutable state

### `createAction`

```ts
const createAction = <U extends unknown[]>(actionFn: (state: Draft<S>, ...params: U) => void): (...params: U) => void;
```

Takes a **pure function** as input and returns a *closured* **action** function that can manipulate a `Draft<S>` of your state. All changes will be committed on the next tick and all the selectors run to determine what needs to be re-rendered.

> ⚠️ This function cannot be asynchronous and should not have side effects.

### `useStoreSelector`

```ts
const useStoreSelector: <R>(selector: (state: S) => R) => R;
```

Hook that given a selector function, will return the output of the selector and re-render the component only when it changes.

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
