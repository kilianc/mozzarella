<div align="center">
  <img src="./.github/mozzarella.png">
  <h1>
    <code>mozzarella</code>
  </h1>
  <p>
    A cheezy-simple <b><code>679 bytes</code></b> hook based <b><code>immutable store</code></b>, that leverages <b><code>useState</code></b> and <b><code>Immer</code></b> to create independent rendering trees, so that your components <b>only re-render when they should</b>.
  </p>
  <br>
  <br>
  <br>
  <br>
</div>

## Motivation

I have been struggling to find a **state management** solution for `react`, that embraces **plain JavaScript** without forcing me to adopt an opinionated pattern, requires a lot of boilerplate code, well typed and that would make sense when looking at it two weeks later.

### Design Goals 🎯

* ✅ Be as simple as a **mozzarella** (duh!)
* ✅ Use immutability without getting in the way
* ✅ Use plain JS functions as actions
* ✅ Use async or sync functions for actions
* ✅ Prevent unnecessary re-rendering of components
* ✅ Batch changes together to prevent race conditions
* ✅ `TypeScript` support

## Install

    $ yarn add --dev --exact mozzarella

## Demos 👩‍💻

CodeSandbox demos

## Basic Example ([try it]())

```tsx
import React from "react";
import ReactDOM from "react-dom";
import { createStore } from "./mozzarella";

// create a store and pass an initial state

const { getState, createAction, useDerivedState } = createStore({
  names: ["kilian", "hassan", "juliet"],
  places: ["san francisco", "salò", "lebanon"]
});

// a Immer Draft<S> is passed to the action creator

const addName = createAction((state, name: string) => {
  state.names.push(name);
});

const addPlace = createAction((state, name: string) => {
  state.places.push(name);
});

// this component only re-renders when `state.names` changes

const Names = () => {
  console.info("<Names /> re-render");
  const names = useDerivedState(state => state.names);

  return (
    <div>
      <button onClick={() => addName("prison mike")}>Add "Prison Mike"</button>
      <button onClick={() => addPlace("scranton")}>Add "Scranton"</button>
      <h2>Names:</h2>
      <ul>
        {names.map((name, key) => (
          <li key={key}>{name}</li>
        ))}
      </ul>
      <h2>State:</h2>
      <pre>{JSON.stringify(getState(), null, 2)}</pre>
    </div>
  );
};

ReactDOM.render(<Names />, document.getElementById("root"));
```

## Example with pure functional components ([try it]())

```tsx
// store.ts

import { createStore } from 'react-create-store'

export const { getState, createAction, useDerivedState } = createStore({
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
  const props = useDerivedState((state) => {
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
  useDerivedState: <R>(selector: (state: S) => R) => R;
  createAction: <U extends unknown[]>(actionFn: (state: Draft<S>, ...params: U) => void) => (...params: U) => void;
}
```

Takes the initial state as parameter and returns an object with three properties:

* [`getState`](#getState)
* [`createAction`](#createAction)
* [`useDerivedState`](#useDerivedState)

### `getState`

```ts
const getState = () => S;
```

Returns the instance of your immutable state

### `createAction`

```ts
const createAction = <U extends unknown[]>(actionFn: (state: Draft<S>, ...params: U) => void): (...params: U) => void;
```

Takes a **pure function** as input and returns a *closured* **action** function that can manipulate a `Draft<S>` of your state.

### `useDerivedState`

```ts
const useDerivedState: <R>(selector: (state: S) => R) => R;
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
