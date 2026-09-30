import type { Action, Field } from '../resource/types.js'

export type ResourceField = Field & { key: string }
export type RecordPermissions = Partial<Record<Action, boolean>>
export type ResourceDescription = {
  name: string
  label: string
  /** Singular record noun in Arabic, or null when the resource does not declare one. */
  recordLabel: string | null
  /** Arabic create-button text, or null to derive «إضافة <recordLabel>» (or «إضافة سجل»). */
  createLabel: string | null
  fields: ResourceField[]
  list: string[]
  show: string[]
  searchable: boolean
  canCreate: boolean
  scoped: boolean
  submittable: boolean
}
export type ResourceNavigation = {
  name: string
  label: string
  href: string
  module: string
  /** Arabic module label, for grouping the navigation by module. */
  moduleLabel: string
}[]
