/**
 * Every store shares this scheduler so that drafts committed in the same tick
 * land in a single flush, no matter how many stores took part in it.
 *
 * A commit callback applies its own draft and returns a notify callback. The
 * flush runs every commit first and every notify afterwards, which guarantees
 * that a selector reading from more than one store never observes a batch that
 * is only half applied.
 */
export type Commit = () => () => void

// Almost every flush belongs to a single store. That case is held in a plain
// variable and never touches the set, so the common path allocates nothing:
// no set entry, no intermediate arrays, no iterator.
let firstCommit: Commit | null = null
const extraCommits = new Set<Commit>()

let flushPromise: Promise<void> | null = null

const flush = () => {
  // Cleared up front so that anything scheduled while flushing lands in the
  // next flush instead of being swallowed by this one.
  flushPromise = null

  const commit = firstCommit
  firstCommit = null

  if (commit === null) return

  if (extraCommits.size === 0) {
    // One store: applying and notifying back to back *is* the two-phase order.
    commit()()
    return
  }

  const commits = [commit, ...extraCommits]
  extraCommits.clear()

  const notifications = commits.map((pending) => pending())
  notifications.forEach((notify) => notify())
}

export const scheduleCommit = (commit: Commit) => {
  if (firstCommit === null) firstCommit = commit
  else if (firstCommit !== commit) extraCommits.add(commit)

  flushPromise = flushPromise || Promise.resolve().then(flush)

  return flushPromise
}
