/**
 * Concurrency policies for actions, in the spirit of ember-concurrency.
 *
 * * `default`    — every call runs, no limit (the historical behaviour)
 * * `drop`       — calls made while the action is at capacity are ignored
 * * `restartable`— a new call cancels the oldest running one
 * * `enqueue`    — calls made while at capacity wait for a free slot
 * * `keepLatest` — like `enqueue`, but only the most recent waiting call is kept
 */
export type ConcurrencyMode =
  'default' | 'drop' | 'restartable' | 'enqueue' | 'keepLatest'

export type ActionOptions = {
  concurrency?: ConcurrencyMode
  /**
   * How many runs may be in flight at once. Defaults to `1` for every mode
   * except `default`, which is unbounded.
   */
  maxConcurrency?: number
}

export type Action<U extends unknown[]> = {
  (...params: U): Promise<void>
  /** `true` while at least one run is in flight. */
  readonly isRunning: boolean
  /** How many runs are in flight. */
  readonly runningCount: number
  /** How many calls are waiting for a free slot. */
  readonly pendingCount: number
  /** Cancels every running run and discards everything waiting. */
  cancelAll(): void
  /** Called whenever `isRunning`, `runningCount` or `pendingCount` change. */
  subscribe(listener: () => void): () => void
}

/** The subset of an action that [[useIsRunning]] needs. */
export type RunnableAction = {
  readonly isRunning: boolean
  subscribe(listener: () => void): () => void
}

const neverAborted = new AbortController().signal
const signals = new WeakMap<object, AbortSignal>()

export const registerSignal = (draft: object, signal: AbortSignal) => {
  signals.set(draft, signal)
}

/**
 * Returns the `AbortSignal` tied to the run that received `state`, so that a
 * cancellable action can hand it to `fetch` and friends. Actions that don't opt
 * into a concurrency mode get a signal that never aborts.
 */
export const getSignal = (state: unknown): AbortSignal => {
  if (state === null || typeof state !== 'object') return neverAborted
  return signals.get(state) || neverAborted
}

const cancelledHandler: ProxyHandler<object> = {
  get(target, key) {
    const descriptor = Reflect.getOwnPropertyDescriptor(target, key)
    const value = Reflect.get(target, key)

    // Proxy invariants forbid handing back a wrapper in place of a
    // non-configurable, non-writable own property.
    if (descriptor && !descriptor.configurable && !descriptor.writable) {
      return value
    }

    return cancelledView(value)
  },
  // Writes are swallowed rather than rejected: throwing would surface as an
  // error in user code that did nothing wrong, it just lost the race.
  set: () => true,
  defineProperty: () => true,
  deleteProperty: () => true
}

/**
 * A read-through, write-nowhere view of the draft. A cancelled run keeps
 * whatever reference it captured before the await, so gating the top level is
 * not enough — every object it reaches through this view is gated too.
 */
export const cancelledView = <T>(target: T): T => {
  if (target === null) return target
  if (typeof target !== 'object' && typeof target !== 'function') return target

  return new Proxy(
    target as unknown as object,
    cancelledHandler
  ) as unknown as T
}
