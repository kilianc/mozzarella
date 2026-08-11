import { DependencyList, useCallback, useEffect, useRef, useState } from 'react'
import { Draft, Objectish, createDraft, finishDraft } from 'immer'
import isEqual from 'react-fast-compare'

import {
  Action,
  ActionOptions,
  cancelledView,
  registerSignal
} from './concurrency.js'
import { scheduleCommit } from './scheduler.js'

type Subscription<S> = {
  selector: (state: S) => unknown
  value: unknown
  set: (value: unknown) => void
}

type Run = {
  cancelled: boolean
  controller: AbortController
}

type QueuedCall<U extends unknown[]> = {
  params: U
  resolve: () => void
  reject: (error: unknown) => void
}

export const createStore = <S extends object>(initialState: S) => {
  const subscriptions = new Set<Subscription<S>>()

  let currentState = initialState
  let draftState = createDraft(currentState as Objectish) as Draft<S>

  // `draftState` is swapped out on every commit, so every proxy trap has to
  // read it through this indirection rather than capturing it.
  const draft = () => draftState as object

  const describe = (key: string | symbol) => {
    const descriptor = Reflect.getOwnPropertyDescriptor(draft(), key)
    // The proxy target is an empty object, so a non-configurable descriptor
    // would break the `ownKeys` invariant.
    return descriptor && { ...descriptor, configurable: true }
  }

  const readTraps = {
    has: (_: object, key: string | symbol) => Reflect.has(draft(), key),
    ownKeys: () => Reflect.ownKeys(draft()),
    getOwnPropertyDescriptor: (_: object, key: string | symbol) => describe(key)
  }

  // The state handed to actions that don't opt into a concurrency mode. It is
  // shared by every such action, which keeps a plain dispatch allocation free.
  const liveProxy = new Proxy(
    {},
    {
      ...readTraps,
      get: (_, key) => Reflect.get(draft(), key),
      set: (_, key, value) => Reflect.set(draft(), key, value),
      deleteProperty: (_, key) => Reflect.deleteProperty(draft(), key)
    }
  ) as Draft<S>

  const getState = () => currentState

  const notifySubscribers = () => {
    subscriptions.forEach((subscription) => {
      const nextState = subscription.selector(currentState)
      if (isEqual(nextState, subscription.value)) return

      subscription.value = nextState
      subscription.set(nextState)
    })
  }

  const commit = () => {
    currentState = finishDraft(draftState) as S
    draftState = createDraft(currentState as Objectish) as Draft<S>

    return notifySubscribers
  }

  const useDerivedState = <R>(
    selector: (state: S) => R,
    dependencies: DependencyList = []
  ): R => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const memoizedSelector = useCallback(selector, dependencies)
    const subscriptionRef = useRef<Subscription<S> | null>(null)

    const [storedState, setDerivedState] = useState(() =>
      memoizedSelector(currentState)
    )

    let derivedState = storedState

    if (subscriptionRef.current === null) {
      subscriptionRef.current = {
        selector: memoizedSelector,
        value: derivedState,
        set: setDerivedState as (value: unknown) => void
      }
    }

    const subscription = subscriptionRef.current

    if (subscription.selector !== memoizedSelector) {
      // The dependencies changed. Recompute right away instead of waiting for
      // the next commit, otherwise this render returns a stale value.
      subscription.selector = memoizedSelector
      const nextState = memoizedSelector(currentState)

      if (!isEqual(nextState, derivedState)) {
        derivedState = nextState
        setDerivedState(nextState)
      }
    }

    subscription.value = derivedState
    // Subscribing during render rather than in the effect means a commit that
    // lands before React flushes effects is not missed.
    subscriptions.add(subscription)

    useEffect(() => {
      subscriptions.add(subscription)

      return () => {
        subscriptions.delete(subscription)
      }
    }, [subscription])

    return derivedState
  }

  function createAction<U extends unknown[]>(
    actionFn: (state: Draft<S>, ...params: U) => void | Promise<void>,
    options: ActionOptions = {}
  ): Action<U> {
    const mode = options.concurrency || 'default'
    const limit = options.maxConcurrency || (mode === 'default' ? Infinity : 1)

    const runs = new Set<Run>()
    const queue: Array<QueuedCall<U>> = []
    const listeners = new Set<() => void>()

    const notify = () => listeners.forEach((listener) => listener())

    const cancel = (run: Run) => {
      run.cancelled = true
      run.controller.abort()
      runs.delete(run)
    }

    const drain = () => {
      while (queue.length > 0 && runs.size < limit) {
        const call = queue.shift() as QueuedCall<U>
        start(call.params).then(call.resolve, call.reject)
      }
    }

    const start = (params: U): Promise<void> => {
      const run: Run = { cancelled: false, controller: new AbortController() }
      let state = liveProxy

      if (mode !== 'default') {
        // Only cancellable actions pay for a per-run proxy. Once the run is
        // cancelled the view still reads, but every write is dropped.
        state = new Proxy(
          {},
          {
            ...readTraps,
            get: (_, key) => {
              const value = Reflect.get(draft(), key)
              return run.cancelled ? cancelledView(value) : value
            },
            set: (_, key, value) =>
              run.cancelled || Reflect.set(draft(), key, value),
            deleteProperty: (_, key) =>
              run.cancelled || Reflect.deleteProperty(draft(), key)
          }
        ) as Draft<S>

        registerSignal(state as object, run.controller.signal)
      }

      runs.add(run)
      notify()

      const settle = () => {
        runs.delete(run)
        drain()
        notify()

        return scheduleCommit(commit)
      }

      const rethrow = (error: unknown) =>
        settle().then(() => {
          throw error
        })

      let result: void | Promise<void>

      try {
        result = actionFn(state, ...params)
      } catch (error) {
        // A failed action still commits whatever it managed to write and still
        // releases its slot, so one throw can't wedge the store.
        return rethrow(error)
      }

      return Promise.resolve(result).then(settle, rethrow)
    }

    const action = ((...params: U): Promise<void> => {
      if (mode === 'restartable') {
        while (runs.size >= limit) {
          cancel(runs.values().next().value as Run)
        }

        return start(params)
      }

      if (runs.size < limit) return start(params)
      if (mode === 'drop') return Promise.resolve()

      // `keepLatest` only ever holds on to the most recent waiting call.
      if (mode === 'keepLatest') {
        queue.splice(0).forEach((call) => call.resolve())
      }

      return new Promise<void>((resolve, reject) => {
        queue.push({ params, resolve, reject })
        notify()
      })
    }) as unknown as Action<U>

    Object.defineProperties(action, {
      isRunning: { get: () => runs.size > 0, enumerable: true },
      runningCount: { get: () => runs.size, enumerable: true },
      pendingCount: { get: () => queue.length, enumerable: true }
    })

    action.cancelAll = () => {
      queue.splice(0).forEach((call) => call.resolve())
      Array.from(runs).forEach(cancel)
      notify()
    }

    action.subscribe = (listener: () => void) => {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    }

    return action
  }

  return {
    getState,
    useDerivedState,
    createAction
  }
}
