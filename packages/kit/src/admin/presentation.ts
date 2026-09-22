import type { Action, Field } from '../resource/types.js'

export type ResourceField = Field & { key: string }
export type RecordPermissions = Partial<Record<Action, boolean>>
export type ResourceDescription = {
  name: string
  label: string
  fields: ResourceField[]
  list: string[]
  show: string[]
  searchable: boolean
  canCreate: boolean
  scoped: boolean
  submittable: boolean
}
export type ResourceNavigation = { name: string; label: string; href: string; module: string }[]
