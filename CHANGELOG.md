# Changelog

## Unreleased

### Changed

* **npm is the only package manager.** `yarn.lock` is replaced by
  `package-lock.json`, the scripts, CI and `tools/Dockerfile` all use `npm`, and
  `.npmrc` sets `save-exact` so dependencies stay pinned the way they already
  were. Contributors run `npm ci`, `npm test`, `npm run bench`.

## 2.0.0

The remaining design goals from the README are done, and the toolchain is on
current majors across the board.

### Added

* **Concurrency controls** on `createAction`, in the spirit of
  [ember-concurrency](http://ember-concurrency.com/docs/task-concurrency):
  `drop`, `restartable`, `enqueue` and `keepLatest`, plus `maxConcurrency`.
  Actions expose `isRunning`, `runningCount`, `pendingCount`, `cancelAll()` and
  `subscribe()`.
* **`useIsRunning(...actions)`** — re-renders a component when any of the given
  actions starts or stops running.
* **`getSignal(state)`** — the `AbortSignal` of the current run, so cancellable
  actions can abort their own requests. A cancelled run also loses the ability
  to write to the state at any depth, which makes `restartable` and `keepLatest`
  safe even when the underlying work can't be aborted.
* **Batching across stores.** Stores now share one scheduler: drafts touched in
  the same tick commit together, and every commit lands before any selector
  runs, so a selector reading from several stores never sees a half applied
  batch.
* **`exports` map, ESM/CJS type markers and `engines`** in `package.json`, so
  the dual build resolves correctly under Node's ESM loader.
* **A benchmark suite** (`yarn bench`) covering dispatch cost, batching,
  fan-out and bundle size. Results are published in the README.
* **A pinned Docker toolchain** (`tools/Dockerfile` + `bin/tools`) for
  contributors who don't want a Node install on their machine.

### Fixed

* Components sharing the same selector *function* no longer clobber each other.
  The subscription registry was keyed by the selector, so the last component to
  render won and the others silently stopped updating.
* `useDerivedState` re-evaluates immediately when its dependencies change.
  Previously it kept returning the value computed with the old dependencies
  until the next commit.
* The selector is no longer re-evaluated on every render of a subscribed
  component — it was being passed eagerly to `useState`, which recomputes it
  even though only the first render uses it.
* An action that throws now commits what it wrote and releases the batch
  window. Before, a single throw left the store unable to commit ever again.
* `Object.keys`, spread and `JSON.stringify` now work on the `state` handed to
  an action. The draft proxy trapped `getOwnPropertyDescriptor` but not
  `ownKeys`, so enumeration came back empty.
* `sideEffects` was the string `"false"` rather than the boolean `false`.

### Changed — breaking

* **Entry point moved** from `lib/{esm,cjs}/create-store.js` to
  `lib/{esm,cjs}/index.js`, and an `exports` map now blocks deep imports.
  `import { createStore } from 'mozzarella'` is unaffected.
* **`createStore` requires an object state** (`<S extends object>`). Passing a
  primitive used to typecheck and then throw inside Immer.
* **A sync action that throws now rejects** the returned promise instead of
  throwing synchronously out of the call, so both failure modes are handled the
  same way.
* **An in-flight async action no longer blocks other actions from committing.**
  Each action commits on the microtask after its own function settles. Before,
  a slow async action held the batch window open and everything dispatched
  meanwhile stayed invisible until it finished.
* **Peer dependency ranges normalised** from `>6.0.0` / `>16.8.0` / `>3.0.0` to
  `>=6.0.0` / `>=16.8.0` / `>=3.0.0`, which is what they always meant.

### Toolchain

* TypeScript 3.9 → **7.0** for building and type checking. TypeScript 7 is the
  native compiler and ships no JS API until 7.1, so the packages that need one
  (`typescript-eslint`, `ts-jest`) resolve `typescript` to
  `@typescript/typescript6` via the side-by-side layout Microsoft documents.
  `tsc` is TypeScript 7, `tsc6` is the 6.0 API.
* ESLint 6 → **10**, migrated to flat config (`eslint.config.mjs`).
  `eslint-plugin-react` was dropped: it still calls APIs ESLint 10 removed and
  has no compatible release. `eslint-plugin-react-hooks` v7 covers what matters
  here, and `react-hooks/exhaustive-deps` is now wired up to check
  `useDerivedState` dependency lists.
* Jest 25 → **30**, React 18 → **19**, `@typescript-eslint` 2 → **8**,
  Prettier 2 → **3**.
* Dropped `@testing-library/react-hooks` and `react-test-renderer`, both
  deprecated and unsupported on React 19. Tests use `renderHook` from
  `@testing-library/react`.
* CI matrix moved from Node 12/14/16 to **20/22/24** and now runs the benchmarks.

## 1.0.7 and earlier

See the [commit history](https://github.com/kilianc/mozzarella/commits/master).
