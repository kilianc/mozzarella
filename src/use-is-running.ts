import { useEffect, useState } from 'react'

import { RunnableAction } from './concurrency.js'

const anyRunning = (actions: RunnableAction[]) =>
  actions.some((action) => action.isRunning)

/**
 * Re-renders the component whenever any of the given actions starts or stops
 * running. Handy for spinners and disabled buttons:
 *
 * ```tsx
 * const isSaving = useIsRunning(save)
 * <button disabled={isSaving}>{isSaving ? 'Saving…' : 'Save'}</button>
 * ```
 */
export const useIsRunning = (...actions: RunnableAction[]): boolean => {
  const [isRunning, setIsRunning] = useState(() => anyRunning(actions))

  useEffect(() => {
    const update = () => setIsRunning(anyRunning(actions))
    const unsubscribes = actions.map((action) => action.subscribe(update))

    // An action may have settled between render and effect.
    update()

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, actions)

  return isRunning
}
