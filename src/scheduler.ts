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

const pendingCommits = new Set<Commit>()
let flushPromise: Promise<void> | null = null

const flush = () => {
  // Cleared up front so that anything scheduled while flushing lands in the
  // next flush instead of being swallowed by this one.
  flushPromise = null

  const commits = Array.from(pendingCommits)
  pendingCommits.clear()

  const notifications = commits.map((commit) => commit())
  notifications.forEach((notify) => notify())
}

export const scheduleCommit = (commit: Commit) => {
  pendingCommits.add(commit)
  flushPromise = flushPromise || Promise.resolve().then(flush)

  return flushPromise
}
