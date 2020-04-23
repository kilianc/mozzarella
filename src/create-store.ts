import { useState, useCallback } from 'react'
import { Draft, createDraft, finishDraft } from 'immer'
import isEqual from 'react-fast-compare'

export const createStore = <S>(initialState: S) => {
  const selectors = new Map()

  let currentState = initialState
  let shouldFinishDraft = true
  let draftState = createDraft(currentState)

  const draftStateProxy = new Proxy(
    {},
    {
      get(_, key) {
        return Reflect.get(draftState as object, key)
      },
      set(_, key, value) {
        return Reflect.set(draftState as object, key, value)
      },
      getOwnPropertyDescriptor(_, key) {
        return Reflect.getOwnPropertyDescriptor(draftState as object, key)
      },
      deleteProperty(_, key) {
        return Reflect.deleteProperty(draftState as object, key)
      },
      has(_, key) {
        return Reflect.has(draftState as object, key)
      }
    }
  )

  const getState = () => {
    return currentState
  }

  const runSelectors = () => {
    selectors.forEach(([oldState, set], selector) => {
      const newState = selector(currentState)
      if (isEqual(newState, oldState)) return
      set(newState)
    })
  }

  const useStoreSubscription = <R>(selector: (state: S) => R) => {
    const memoizedSelector = useCallback(selector, [])
    const stateSelectorResult = memoizedSelector(currentState)
    const [oldState, setState] = useState(stateSelectorResult)
    selectors.set(memoizedSelector, [oldState, setState])

    return stateSelectorResult
  }

  const finishDraftFn = () => {
    currentState = finishDraft(draftState)
    draftState = createDraft(currentState)
    runSelectors()
    shouldFinishDraft = true
  }

  function createAction<U extends unknown[]>(
    actionFn: (state: Draft<S>, ...params: U) => void
  ) {
    return (...params: U) => {
      const result = Promise.resolve(
        actionFn(draftStateProxy as Draft<S>, ...params)
      ).then(shouldFinishDraft ? finishDraftFn : null)

      shouldFinishDraft = false

      return result
    }
  }

  return {
    getState,
    useStoreSubscription,
    createAction
  }
}
