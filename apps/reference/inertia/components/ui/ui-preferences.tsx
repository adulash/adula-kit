import { usePage } from '@inertiajs/react'
import type { UiPreferences } from '@adula/kit'

/** A consumer without shared preferences keeps the documented defaults. */
export function useUiPreferences(): UiPreferences {
  const page = usePage<{ uiPreferences?: UiPreferences }>()
  return (
    page.props.uiPreferences ?? {
      calendar: 'gregory',
      confirmDialogClose: true,
      pageTransitions: true,
    }
  )
}
