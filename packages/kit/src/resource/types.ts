import type { Knex } from 'knex'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { WorkflowDefinition } from '../workflows/define_workflow.js'
import type { Conditions } from '../auth/conditions.js'

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
      type: 'string' | 'text' | 'integer' | 'money' | 'boolean' | 'date' | 'datetime' | 'json'
    }
  | {
      type: 'attachment'
      /**
       * Lower-case file extensions accepted for upload, or 'any'. Defaults to
       * DEFAULT_ATTACHMENT_EXTENSIONS (documents, images and archives).
       */
      accept?: string[] | 'any'
      /** Upload size limit such as '5mb'. Defaults to '20mb'. */
      maxSize?: string
    }
  | { type: 'belongsTo'; resource: string }
  /**
   * A user of this deployment (foreign key to users). Choices are active members of
   * the record's organization unit or its ancestors; readers see only the display name.
   */
  | { type: 'user' }
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
/** A changeable list value a module needs before its records can be saved. */
export type ModuleLookup = { key: string; label: Label; sort?: number }
/** A role a module ships; its rules go through the same validation as the roles screen. */
export type ModuleRole = {
  /** Stable key that workflows address ({ role: key }); see roles.key. */
  key: string
  /** Arabic display name; administrators may rename it later. */
  name: string
  permissionLevel?: number
  rules: readonly {
    subject: string
    action: string
    inverted?: boolean
    conditions?: Conditions | null
    fields?: string[] | null
  }[]
}
export type Module = {
  name: string
  reference?: boolean
  label: Label
  dependsOn: readonly string[]
  resources: readonly Resource[]
  /** Versioned workflows of this module's submittable resources (phase 4). */
  workflows?: readonly WorkflowDefinition[]
  /**
   * Lookup rows by group. adula:install inserts missing rows and never changes or
   * removes existing ones, so administrator edits survive upgrades.
   */
  lookups?: Readonly<Record<string, readonly ModuleLookup[]>>
  /**
   * Roles created by adula:install when no role has their key yet. An existing role
   * is never modified, so administrators own every role after installation.
   */
  defaultRoles?: readonly ModuleRole[]
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
