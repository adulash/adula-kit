import type { Knex } from 'knex'
import type { LucidModel } from '@adonisjs/lucid/types/model'

export type Label = { ar: string; en: string }
export type Action = 'view' | 'create' | 'update' | 'delete' | 'submit' | 'cancel' | 'amend'
export type Scalar = string | number | boolean | null
export type RecordData = Record<string, unknown>
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
export type SerializedRecord = Record<string, JsonValue>
export type Field = {
  label: Label
  column?: string
  required?: boolean
  unique?: boolean
  sortable?: boolean
  searchable?: boolean
  filterable?: boolean
  permissionLevel?: number
  sequence?: string
} & (
  | {
      type:
        | 'string'
        | 'text'
        | 'integer'
        | 'money'
        | 'boolean'
        | 'date'
        | 'datetime'
        | 'json'
        | 'attachment'
    }
  | { type: 'belongsTo'; resource: string }
  | { type: 'hasMany'; resource: string; foreignKey: string; inline?: boolean }
  | { type: 'lookup'; group: string }
)
export type Resource = {
  name: string
  label: Label
  model: LucidModel
  scoped: boolean
  submittable?: boolean
  version?: boolean
  customFields?: boolean
  fields: Record<string, Field>
  list: readonly string[]
  form: readonly string[]
  show: readonly string[]
  serialize?: readonly string[]
  hidden?: readonly string[]
  actions: readonly Action[]
  validator: { validate(data: unknown): Promise<RecordData> }
  hooks?: {
    beforeSave?: (record: RecordData, context: HookContext) => Promise<void>
    afterSave?: (record: RecordData, context: HookContext) => Promise<void>
  }
}
export type HookContext = { trx: Knex.Transaction; userId: number; action: Action }
export type Module = {
  name: string
  reference?: boolean
  label: Label
  dependsOn: readonly string[]
  resources: readonly Resource[]
}
export type ResourceInput<F extends Record<string, Field>> = Omit<
  Resource,
  'fields' | 'list' | 'form' | 'show' | 'hidden' | 'serialize'
> & {
  fields: F
  list: readonly (keyof F & string)[]
  form: readonly (keyof F & string)[]
  show: readonly (keyof F & string)[]
  hidden?: readonly (keyof F & string)[]
  serialize?: readonly (keyof F & string)[]
}
