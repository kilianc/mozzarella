import { useState } from 'react'
import { renderHook, act } from '@testing-library/react-hooks'
import { createStore } from './create-store'

test('should correctly create a store', () => {
  const store = createStore({
    pizza: 'ya',
    pasta: 'yas',
    mozzarella: 'yas!'
  })

  expect(store.getState).toBeDefined()
  expect(store.useStoreSubscription).toBeDefined()
  expect(store.createAction).toBeDefined()
})

test('should re-render components only when the selected state changes', async () => {
  const { getState, createAction, useStoreSubscription } = createStore({
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
    return useStoreSubscription((state) => state.colors)
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
  const { createAction, useStoreSubscription } = createStore({
    answer: 0
  })

  const findAnswer = createAction(async (state) => {
    state.answer++
  })

  let count = 0
  const { result } = renderHook(() => {
    return useStoreSubscription((state) => {
      count++
      return state.answer
    })
  })

  await act(async () => {
    for (let i = 0; i < 5; i++) {
      findAnswer()
    }
  })

  expect(count).toBe(3)
  expect(result.current).toBe(5)
})

test('should work with async actions', async () => {
  type State = {
    books: Array<{
      title: string
      rating?: number
    }>
  }
  const { createAction, useStoreSubscription } = createStore<State>({
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

  const { result } = renderHook(() =>
    useStoreSubscription((state) => state.books)
  )

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
  const OriginalMap = window.Map
  class MapMock extends OriginalMap {
    static instances: Array<unknown> = []
    constructor() {
      super()
      MapMock.instances.push(this)
    }
  }

  window.Map = MapMock
  const { useStoreSubscription } = createStore({ value: 0 })
  window.Map = OriginalMap

  let count = 0
  renderHook(() => {
    const [foo, setFoo] = useState(0)
    const [baseValue, setBaseValue] = useState(0)

    useStoreSubscription(
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
  })

  expect(count).toBe(4)
  expect(MapMock.instances.length).toBe(1)
})
