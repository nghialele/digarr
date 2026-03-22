import { useCallback, useEffect, useState } from 'react'
import { getUserPreferences, updateUserPreferences } from '@/web/lib/api'

export function useHints() {
  const [dismissedHints, setDismissedHints] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getUserPreferences()
      .then((prefs) => {
        setDismissedHints((prefs?.dismissedHints as string[] | undefined) ?? [])
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  const isHintDismissed = useCallback((id: string) => dismissedHints.includes(id), [dismissedHints])

  const dismissHint = useCallback(
    async (id: string) => {
      const updated = [...dismissedHints, id]
      setDismissedHints(updated)
      try {
        await updateUserPreferences({ dismissedHints: updated })
      } catch {
        // best-effort
      }
    },
    [dismissedHints],
  )

  return { isHintDismissed, dismissHint, loaded }
}
