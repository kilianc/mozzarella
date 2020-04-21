# react-selectable-store

```tsx
import { createStore } from 'react-create-store'

const { getState, createAction, useStoreSelector } = createStore({
  names: ['kilian', 'hassan', 'juliet'],
  places: ['san francisco', 'salò', 'lebanon']
})

const addName = createAction((state, name: string) => {
  state.names.push(name)
})

const addPlace = createAction((state, name: string) => {
  state.places.push(name)
})

const MyComponent = () => {
  const names = useStoreSelector((state) => state.names)
  return names.map((name, key) => <span key={key}>{name}</span>)
}
```

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
