import { useCallback } from 'react'
import { Draft, createDraft, finishDraft } from 'immer'
import { useSafeSetState } from './safe-set-state'
import isEqual from 'react-fast-compare'

export const createStore = <S>(initialState: S) => {
  const selectors = new Map()

  let currentState = initialState
  let finishDraftTimeout: ReturnType<typeof setTimeout> | null = null
  let draftState: Draft<S> | null = null

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

  const useStoreSelector = <R>(selector: (state: S) => R) => {
    const memoizedSelector = useCallback(selector, [])
    const stateSelectorResult = memoizedSelector(currentState)
    const [oldState, setState] = useSafeSetState(stateSelectorResult)
    selectors.set(memoizedSelector, [oldState, setState])

    return stateSelectorResult
  }

  function createAction<U extends unknown[]>(
    actionFn: (state: Draft<S>, ...params: U) => void
  ) {
    return (...params: U) => {
      if (draftState === null) {
        draftState = createDraft(currentState)
      }

      actionFn(draftState, ...params)

      if (!finishDraftTimeout) {
        finishDraftTimeout = setTimeout(() => {
          finishDraftTimeout = null
          currentState = finishDraft(draftState) as S
          draftState = null
          runSelectors()
        }, 100)
      }
    }
  }

  return {
    getState,
    useStoreSelector,
    createAction
  }
}
