import { useState, useCallback, DependencyList, useRef, useEffect } from 'react'
import { Draft, createDraft, finishDraft } from 'immer'
import isEqual from 'react-fast-compare'

export const createStore = <S>(initialState: S) => {
  const selectors = new Map()

  let currentState = initialState
  let draftState = createDraft(currentState)
  let shouldFinishDraft = true

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

  const useDerivedState = <R>(
    selector: (state: S) => R,
    dependencies: DependencyList = []
  ) => {
    // eslint-disable-next-line
    const memoizedSelector = useCallback(selector, dependencies)
    const memoizedSelectorRef = useRef(memoizedSelector)

    const [derivedState, setDerivedState] = useState(
      memoizedSelector(currentState)
    )

    if (memoizedSelectorRef.current !== memoizedSelector) {
      selectors.delete(memoizedSelectorRef.current)
      memoizedSelectorRef.current = memoizedSelector
    }

    selectors.set(memoizedSelector, [derivedState, setDerivedState])

    useEffect(() => {
      return () => {
        selectors.delete(memoizedSelectorRef.current)
      }
    }, [])

    return derivedState
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
    useDerivedState,
    createAction
  }
}
