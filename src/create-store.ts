import { useCallback } from 'react'
import { Draft, createDraft, finishDraft } from 'immer'
import { useSafeSetState } from './safe-set-state'

export const createStore = <S>(initialState: S) => {
  const selectors = new Map()

  let currentState = initialState
  let finishDraftTimeout: number | null = null
  let draftState: Draft<S> | null = null

  const getState = () => {
    return currentState
  }

  const runSelectors = () => {
    selectors.forEach((set, selector) => {
      set(selector(currentState))
    })
  }

  const useStoreSelector = <R>(selector: (state: S) => R) => {
    const memoizedSelector = useCallback(selector, [])
    const stateSelectorResult = memoizedSelector(currentState)
    const [, setState] = useSafeSetState(stateSelectorResult)
    selectors.set(memoizedSelector, setState)

    return stateSelectorResult
  }

  function createAction<A, U extends unknown[]>(
    actionFn: (state: Draft<S>, ...params: U) => A
  ) {
    return (...params: U) => {
      if (draftState === null) {
        draftState = createDraft(currentState)
      }

      const result = actionFn(draftState, ...params)

      if (!finishDraftTimeout) {
        finishDraftTimeout = setTimeout(() => {
          finishDraftTimeout = null
          currentState = finishDraft(draftState) as S
          draftState = null
          runSelectors()
        })
      }

      return result
    }
  }

  return {
    getState,
    useStoreSelector,
    createAction
  }
}
