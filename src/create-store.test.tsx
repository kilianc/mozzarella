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
    names: ['kilian', 'hassan', 'juliet'],
    places: ['san francisco', 'salò', 'lebanon']
  })

  expect(store.getState).toBeDefined()
  expect(store.useStoreSelector).toBeDefined()
  expect(store.createAction).toBeDefined()
})

test('should re-render components only when the selected state changes', async () => {
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

  let count = 0
  const { result } = renderHook(() => {
    count++
    return useStoreSelector((state) => state.names)
  })

  expect(count).toBe(1)
  expect(result.current).toEqual(['kilian', 'hassan', 'juliet'])
  expect(getState()).toEqual({
    names: ['kilian', 'hassan', 'juliet'],
    places: ['san francisco', 'salò', 'lebanon']
  })

  act(() => {
    addName('foo')
    jest.runAllTimers()
  })

  expect(count).toBe(2)
  expect(result.current).toEqual(['kilian', 'hassan', 'juliet', 'foo'])
  expect(getState()).toEqual({
    names: ['kilian', 'hassan', 'juliet', 'foo'],
    places: ['san francisco', 'salò', 'lebanon']
  })

  act(() => {
    addPlace('foo')
    jest.runAllTimers()
  })

  expect(count).toBe(2)
  expect(result.current).toEqual(['kilian', 'hassan', 'juliet', 'foo'])
  expect(getState()).toEqual({
    names: ['kilian', 'hassan', 'juliet', 'foo'],
    places: ['san francisco', 'salò', 'lebanon', 'foo']
  })
})
