import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { getUserPreferences, updateUserPreferences } from '@/web/lib/api'

export function useHints() {
  const queryClient = useQueryClient()

  const { data: prefs, isSuccess } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: getUserPreferences,
  })

  const dismissedHints: string[] = (prefs?.dismissedHints as string[] | undefined) ?? []

  const isHintDismissed = useCallback(
    (id: string) => !isSuccess || dismissedHints.includes(id),
    [dismissedHints, isSuccess],
  )

  const dismissHint = useCallback(
    async (id: string) => {
      const updated = [...dismissedHints, id]
      queryClient.setQueryData(
        ['user-preferences'],
        (old: Record<string, unknown> | undefined) => ({
          ...(old ?? {}),
          dismissedHints: updated,
        }),
      )
      try {
        await updateUserPreferences({ dismissedHints: updated })
      } catch {
        // best-effort
      }
    },
    [dismissedHints, queryClient],
  )

  return { isHintDismissed, dismissHint, loaded: isSuccess }
}
