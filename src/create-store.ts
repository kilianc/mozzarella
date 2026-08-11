import { DependencyList, useCallback, useEffect, useRef, useState } from 'react'
import { Draft, Immer, Objectish } from 'immer'
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
  controller: AbortController | null
}

type QueuedCall<U extends unknown[]> = {
  params: U
  resolve: () => void
  reject: (error: unknown) => void
}

/** An indexable view of the draft, for the proxy traps. */
type Indexable = Record<string | symbol, unknown>

export type StoreOptions = {
  /**
   * Whether committed state is deep-frozen, so that mutating it outside an
   * action throws instead of silently desynchronising the store.
   *
   * Immer walks every container it copied to do this, which makes a commit
   * cost scale with the size of the state rather than with the size of the
   * change. Defaults to `true` outside production and `false` in it: the guard
   * catches real bugs while you are writing the code, and the throughput
   * matters once you ship.
   */
  freeze?: boolean
}

declare const process: { env: Record<string, string | undefined> }

const isProduction = (() => {
  try {
    // Written as a literal member expression so bundlers substitute it and
    // drop the branch. Plain ES modules have no `process` at all, hence the
    // catch — and no bundler means no production build, so `false` is right.
    return process.env.NODE_ENV === 'production'
  } catch {
    return false
  }
})()

const noop = () => {}

export const createStore = <S extends object>(
  initialState: S,
  options: StoreOptions = {}
) => {
  // A private Immer instance rather than the global `setAutoFreeze`, so that
  // the store's freezing policy cannot leak into the app's own `produce` calls.
  const immer = new Immer({ autoFreeze: options.freeze ?? !isProduction })

  const subscriptions = new Set<Subscription<S>>()

  let currentState = initialState
  // Created on first touch, not up front. A tick in which nothing reads or
  // writes the state costs nothing, and the commit that follows it can be
  // skipped whole rather than round-tripping the state through Immer.
  let draftState: Draft<S> | null = null

  // `draftState` is swapped out on every commit, so every proxy trap has to
  // read it through this indirection rather than capturing it.
  const draft = (): Indexable => {
    if (draftState === null) {
      draftState = immer.createDraft(currentState as Objectish) as Draft<S>
    }

    return draftState as Indexable
  }

  const describe = (key: string | symbol) => {
    const descriptor = Reflect.getOwnPropertyDescriptor(draft(), key)
    // The proxy target is an empty object, so a non-configurable descriptor
    // would break the `ownKeys` invariant.
    return descriptor && { ...descriptor, configurable: true }
  }

  const readTraps = {
    has: (_: object, key: string | symbol) => key in draft(),
    ownKeys: () => Reflect.ownKeys(draft()),
    getOwnPropertyDescriptor: (_: object, key: string | symbol) => describe(key)
  }

  // The state handed to actions that don't opt into a concurrency mode. It is
  // shared by every such action, which keeps a plain dispatch allocation free.
  // The traps index the draft directly: `Reflect` costs a measurable amount
  // per property access here, and buys nothing the traps don't already have.
  const liveProxy = new Proxy(
    {},
    {
      ...readTraps,
      get: (_, key) => draft()[key],
      set: (_, key, value) => ((draft()[key] = value), true),
      deleteProperty: (_, key) => delete draft()[key]
    }
  ) as Draft<S>

  const getState = () => currentState

  const notifySubscribers = () => {
    subscriptions.forEach((subscription) => {
      const nextState = subscription.selector(currentState)
      const previous = subscription.value

      // Immer shares structure, so a slice the commit didn't touch comes back
      // identical and never reaches the deep comparison.
      if (nextState === previous || isEqual(nextState, previous)) return

      subscription.value = nextState
      subscription.set(nextState)
    })
  }

  const commit = () => {
    // Nothing ever asked for the draft, so there is nothing to apply.
    if (draftState === null) return noop

    const nextState = immer.finishDraft(draftState) as S
    draftState = null

    // The draft was read but never written. Immer hands back the base state
    // unchanged, so no selector can have a new value to report.
    if (nextState === currentState) return noop

    currentState = nextState

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
    // Only a cancellable run can ever observe its own cancellation, so only a
    // cancellable run needs a per-run state proxy and an `AbortController`.
    const cancellable = mode !== 'default'

    // Only cancellable runs are ever held individually. A `default` run is
    // reachable by nothing, so it is counted rather than allocated and
    // inserted — `runningCount` is the single source of truth for both.
    const runs = new Set<Run>()
    const queue: Array<QueuedCall<U>> = []
    const listeners = new Set<() => void>()

    let runningCount = 0
    // Bumped by `cancelAll` so that runs started before it don't decrement a
    // count that has already been reset out from under them.
    let generation = 0
    let draining = false

    const notify = () => {
      if (listeners.size > 0) listeners.forEach((listener) => listener())
    }

    const cancel = (run: Run) => {
      run.cancelled = true
      run.controller?.abort()
      if (runs.delete(run)) runningCount--
    }

    const drain = () => {
      // A synchronous queued call settles before `start` returns, which
      // re-enters `drain`. Bouncing the re-entrant call keeps the queue
      // draining in this loop instead of one stack frame per call.
      if (draining) return
      draining = true

      try {
        while (queue.length > 0 && runningCount < limit) {
          const call = queue.shift() as QueuedCall<U>
          start(call.params).then(call.resolve, call.reject)
        }
      } finally {
        draining = false
      }
    }

    const start = (params: U): Promise<void> => {
      let run: Run | null = null
      let state = liveProxy
      const startedAt = generation

      if (cancellable) {
        // Once the run is cancelled the view still reads, but every write is
        // dropped.
        const current: Run = {
          cancelled: false,
          controller: new AbortController()
        }
        run = current

        state = new Proxy(
          {},
          {
            ...readTraps,
            get: (_, key) => {
              const value = draft()[key]
              return current.cancelled ? cancelledView(value) : value
            },
            set: (_, key, value) =>
              current.cancelled || ((draft()[key] = value), true),
            deleteProperty: (_, key) => current.cancelled || delete draft()[key]
          }
        ) as Draft<S>

        registerSignal(state as object, current.controller!.signal)
        runs.add(current)
      }

      runningCount++
      notify()

      const settle = () => {
        // `cancelAll` may have released this slot already, either by taking the
        // run out of the set or by resetting the count under a new generation.
        if (run !== null) {
          if (runs.delete(run)) runningCount--
        } else if (startedAt === generation) {
          runningCount--
        }

        drain()
        notify()

        return scheduleCommit(commit)
      }

      let result: void | Promise<void>

      try {
        result = actionFn(state, ...params)
      } catch (error) {
        // A failed action still commits whatever it managed to write and still
        // releases its slot, so one throw can't wedge the store.
        return settle().then(() => {
          throw error
        })
      }

      // Synchronous actions are the common case, and routing one through
      // `Promise.resolve(...).then(...)` buys an extra allocation and an extra
      // microtask hop for a value that is already settled. The awaited promise
      // is the flush either way, so callers see no difference.
      const pending = result as PromiseLike<void> | undefined

      if (!pending || typeof pending.then !== 'function') return settle()

      return Promise.resolve(pending).then(settle, (error) =>
        settle().then(() => {
          throw error
        })
      )
    }

    const action = ((...params: U): Promise<void> => {
      if (mode === 'restartable') {
        while (runningCount >= limit) {
          cancel(runs.values().next().value as Run)
        }

        return start(params)
      }

      if (runningCount < limit) return start(params)
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
      isRunning: { get: () => runningCount > 0, enumerable: true },
      runningCount: { get: () => runningCount, enumerable: true },
      pendingCount: { get: () => queue.length, enumerable: true }
    })

    action.cancelAll = () => {
      queue.splice(0).forEach((call) => call.resolve())

      if (cancellable) Array.from(runs).forEach(cancel)
      // A `default` run holds no handle to cancel, so releasing its slot is all
      // `cancelAll` can do. The new generation stops it double-decrementing.
      else if (runningCount > 0) {
        generation++
        runningCount = 0
      }

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
