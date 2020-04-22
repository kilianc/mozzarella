import { renderHook, act } from '@testing-library/react-hooks'
import { createStore } from './create-store'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.runAllTimers()
})

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

  act(() => {
    addColor('blue')
    jest.runAllTimers()
  })

  expect(count).toBe(2)
  expect(result.current).toEqual(['green', 'white', 'red', 'blue'])
  expect(getState()).toEqual({
    colors: ['green', 'white', 'red', 'blue'],
    cities: ['brescia', 'roma', 'firenze']
  })

  act(() => {
    addCity('venezia')
    jest.runAllTimers()
  })

  expect(count).toBe(2)
  expect(result.current).toEqual(['green', 'white', 'red', 'blue'])
  expect(getState()).toEqual({
    colors: ['green', 'white', 'red', 'blue'],
    cities: ['brescia', 'roma', 'firenze', 'venezia']
  })
})
