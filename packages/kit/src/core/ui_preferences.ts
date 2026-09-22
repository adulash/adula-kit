import type { Knex } from 'knex'
import { Settings } from '../services/settings.js'
import { KitError } from '../admin/errors.js'

export type CalendarSystem = 'gregory' | 'islamic-umalqura'
export type CalendarPreference = CalendarSystem | 'both'
export type UiPreferences = {
  calendar: CalendarPreference
  confirmDialogClose: boolean
  pageTransitions: boolean
}
export const UI_PREFERENCES_KEY = 'ui.preferences'
export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  calendar: 'gregory',
  confirmDialogClose: true,
  pageTransitions: true,
}

export function validateUiPreferences(value: unknown): UiPreferences {
  const input = value as UiPreferences | undefined
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    !['gregory', 'islamic-umalqura', 'both'].includes(input.calendar) ||
    typeof input.confirmDialogClose !== 'boolean' ||
    typeof input.pageTransitions !== 'boolean' ||
    Object.keys(input).some((key) => !(key in DEFAULT_UI_PREFERENCES))
  )
    throw new KitError(
      422,
      'E_UI_PREFERENCES',
      'اختر تقويمًا صالحًا وحدد خيارات تأكيد الإغلاق والانتقالات'
    )
  return {
    calendar: input.calendar,
    confirmDialogClose: input.confirmDialogClose,
    pageTransitions: input.pageTransitions,
  }
}

export async function uiPreferences(db: Knex): Promise<UiPreferences> {
  const value = await new Settings(db).get(UI_PREFERENCES_KEY)
  if (value === undefined) return { ...DEFAULT_UI_PREFERENCES }
  return validateUiPreferences(value)
}
