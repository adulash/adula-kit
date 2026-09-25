import { subject } from '@casl/ability'
import type { Knex } from 'knex'
import type { ResourceRegistry } from '../resource/registry.js'
import type { Action, RecordData, Resource, SerializedRecord } from '../resource/types.js'
import { columnName } from '../resource/define_resource.js'
import {
  buildAbility,
  canRecord,
  inOrgScope,
  type Actor,
  type KitAbility,
} from '../auth/ability.js'
import { accessibleBy, conditionSql } from '../auth/sql.js'
import { fromRow, selectedFields, serialize, writableInput } from './contracts.js'
import { KitError } from './errors.js'
import { sequence } from '../services/settings.js'
import { recordMutation, type FieldChange } from '../events/record_mutation.js'
import { fieldValue } from '../resource/values.js'
import {
  claimAttachment,
  isAttachmentId,
  loadAttachments,
  releaseAttachment,
} from '../attachments/attachment_service.js'
import type {
  RecordPermissions,
  ResourceDescription,
  ResourceNavigation,
  ResourceField,
} from './presentation.js'

export type ListOptions = {
  limit?: number
  cursor?: string
  search?: string
  sort?: string
  direction?: 'asc' | 'desc'
  filters?: Record<string, unknown>
  /** Only records carrying this tag (see RecordCollaboration.setTags). */
  tag?: string
  estimate?: boolean
}

/**
 * Whether an actor may sort, filter or search by a field. Querying reveals values
 * indirectly, so it needs unconditional view access at the field's level.
 */
export function canQueryField(resource: Resource, actor: Actor, ability: KitAbility, key: string) {
  const level = Math.max(
    resource.fields[key].permissionLevel ?? 0,
    resource.hidden?.includes(key) ? 1 : 0
  )
  // Conditional field rules cannot safely authorize a global sort/search.
  return (
    actor.permissionLevel >= level &&
    ability.can('view', resource.name, key) &&
    !ability.rules.some(
      (rule) =>
        rule.conditions &&
        (!rule.fields || rule.fields.includes(key)) &&
        (rule.subject === resource.name || rule.subject === 'all')
    )
  )
}

export class ResourceService {
  constructor(
    private db: Knex,
    private registry: ResourceRegistry
  ) {}

  /** The Arabic label of a registered resource, for notifications and titles. */
  label(name: string) {
    return this.registry.get(name).label.ar
  }

  /** Project navigation is derived from registered resources and the current actor. */
  navigation(actor: Actor): ResourceNavigation {
    const ability = buildAbility(actor.rules, this.registry.all())
    const children = new Set(
      this.registry
        .all()
        .flatMap((resource) =>
          Object.values(resource.fields).flatMap((field) =>
            field.type === 'hasMany' ? [field.resource] : []
          )
        )
    )
    return this.registry
      .all()
      .filter(
        (resource) =>
          !children.has(resource.name) &&
          resource.actions.includes('view') &&
          (!resource.scoped || actor.orgPaths.length > 0) &&
          ability.can('view', resource.name)
      )
      .map((resource) => ({
        name: resource.name,
        label: resource.label.ar,
        href: `/resources/${resource.name}`,
        module: this.registry.owner(resource.name),
      }))
  }

  describe(name: string, actor: Actor): ResourceDescription {
    const resource = this.registry.get(name)
    const ability = this.authorizeAction(resource, actor, 'view')
    const serialized = new Set(resource.serialize ?? [...resource.list, ...resource.show])
    const fields = Object.entries(resource.fields)
      .filter(
        ([key, field]) =>
          serialized.has(key) &&
          actor.permissionLevel >=
            Math.max(field.permissionLevel ?? 0, resource.hidden?.includes(key) ? 1 : 0) &&
          ability.can('view', name, key)
      )
      .map(([key, field]) => ({
        ...field,
        key,
        sortable: Boolean(field.sortable && this.canQueryField(resource, actor, ability, key)),
        filterable: Boolean(field.filterable && this.canQueryField(resource, actor, ability, key)),
      }))
    const visible = new Set(fields.map((field) => field.key))
    const searchable = Object.entries(resource.fields).filter(([, field]) => field.searchable)
    return {
      name,
      label: resource.label.ar,
      fields,
      list: resource.list.filter((key) => visible.has(key)),
      show: resource.show.filter((key) => visible.has(key)),
      searchable:
        searchable.length > 0 &&
        searchable.every(([key]) => this.canQueryField(resource, actor, ability, key)),
      canCreate: resource.actions.includes('create') && ability.can('create', name),
      scoped: resource.scoped,
      submittable: Boolean(resource.submittable),
    }
  }

  private permissions(
    resource: Resource,
    record: RecordData,
    actor: Actor,
    ability: KitAbility
  ): RecordPermissions {
    return Object.fromEntries(
      resource.actions.map((action) => [
        action,
        canRecord(ability, actor, resource, action, record) &&
          (!resource.submittable ||
            !['update', 'delete', 'submit'].includes(action) ||
            record.docStatus === 0) &&
          (action !== 'cancel' || (resource.submittable && record.docStatus === 1)) &&
          (action !== 'amend' || (resource.submittable && record.docStatus === 2)),
      ])
    )
  }

  private normalizeValues(resource: Resource, record: RecordData) {
    for (const [key, field] of Object.entries(resource.fields)) {
      if (!(key in record)) continue
      try {
        record[key] = fieldValue(field, record[key])
      } catch (error) {
        throw new KitError(422, 'E_FIELD_VALUE', `${key}: ${(error as Error).message}`)
      }
    }
  }

  /** Stored attachment ids become summaries for readers; copies keep policy checks on raw rows. */
  private async hydrate(db: Knex, resource: Resource, records: RecordData[]) {
    const keys = Object.keys(resource.fields).filter(
      (key) => resource.fields[key].type === 'attachment'
    )
    if (!keys.length || !records.length) return records
    const ids = records.flatMap((record) => keys.map((key) => record[key]).filter(isAttachmentId))
    const summaries = await loadAttachments(db, ids)
    return records.map((record) => {
      const copy = { ...record }
      for (const key of keys)
        if (key in copy)
          copy[key] = isAttachmentId(copy[key]) ? (summaries.get(copy[key]) ?? null) : null
      return copy
    })
  }
  private async hydrateOne(db: Knex, resource: Resource, record: RecordData) {
    const [hydrated] = await this.hydrate(db, resource, [record])
    return hydrated
  }

  private authorizeAction(resource: Resource, actor: Actor, action: Action) {
    const ability = buildAbility(actor.rules, this.registry.all())
    if (!resource.actions.includes(action) || !ability.can(action, resource.name))
      throw new KitError(403, 'E_FORBIDDEN', 'ليس لديك صلاحية لهذا الإجراء')
    for (const rule of ability.rulesFor(action, resource.name))
      conditionSql(rule.conditions, resource)
    return ability
  }

  private scopedQuery(db: Knex, resource: Resource, actor: Actor) {
    const query = db(`${resource.name} as r`).whereNull('r.deleted_at')
    if (resource.scoped) {
      query.join('org_units as ou', 'ou.id', 'r.org_unit_id').where((scope) => {
        if (!actor.orgPaths.length) scope.whereRaw('FALSE')
        actor.orgPaths.forEach((path) => scope.orWhereRaw('ou.path <@ ?::ltree', [path]))
      })
    }
    return query
  }
  private columns(resource: Resource, ability: KitAbility, write = false, extra: string[] = []) {
    return selectedFields(resource, ability, { write, extra }).map(
      (key) => `r.${resource.fields[key]?.column ?? columnName(key)}`
    )
  }
  private async find(
    db: Knex,
    resource: Resource,
    actor: Actor,
    ability: KitAbility,
    id: number,
    lock = false
  ) {
    const query = this.scopedQuery(db, resource, actor)
      .where('r.id', id)
      .select(this.columns(resource, ability, lock))
    if (resource.scoped) query.select('ou.path as org_path')
    if (lock) query.forUpdate('r')
    const row = await query.first()
    if (!row) throw new KitError(404, 'E_NOT_FOUND', 'السجل غير موجود')
    return fromRow(row, resource)
  }
  private requireRecord(
    ability: KitAbility,
    actor: Actor,
    resource: Resource,
    action: Action,
    record: RecordData
  ) {
    if (resource.scoped && !inOrgScope(record.orgPath, actor.orgPaths))
      throw new KitError(404, 'E_NOT_FOUND', 'السجل غير موجود')
    if (!canRecord(ability, actor, resource, action, record))
      throw new KitError(403, 'E_FORBIDDEN', 'ليس لديك صلاحية لهذا الإجراء')
  }

  /**
   * Authorizes one record for collaboration features (comments, tags, assignments...).
   * Scope and conditional rules apply exactly as for show/update.
   */
  async access(
    name: string,
    id: number,
    actor: Actor,
    action: Action = 'view',
    db: Knex = this.db
  ) {
    let resource: Resource
    try {
      resource = this.registry.get(name)
    } catch {
      throw new KitError(404, 'E_NOT_FOUND', 'الكيان غير موجود')
    }
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new KitError(404, 'E_NOT_FOUND', 'السجل غير موجود')
    const ability = this.authorizeAction(resource, actor, action)
    const record = await this.find(db, resource, actor, ability, id)
    this.requireRecord(ability, actor, resource, action, record)
    return { resource, record, ability }
  }

  /** Whether a (possibly other) actor may perform an action on a record; never throws for denial. */
  async permits(name: string, id: number, actor: Actor, action: Action = 'view') {
    try {
      await this.access(name, id, actor, action)
      return true
    } catch (error) {
      if (error instanceof KitError && [403, 404].includes(error.status)) return false
      throw error
    }
  }

  async list(name: string, actor: Actor, options: ListOptions = {}) {
    const resource = this.registry.get(name)
    const ability = this.authorizeAction(resource, actor, 'view')
    const limit = Math.max(1, Math.min(100, Math.floor(Number(options.limit) || 25)))
    const sort = options.sort ?? 'id'
    const direction = options.direction === 'desc' ? 'desc' : 'asc'
    if (sort !== 'id' && !resource.fields[sort]?.sortable)
      throw new KitError(422, 'E_SORT', 'Unsupported sort field')
    // Sorting/filtering private fields would otherwise reveal their values indirectly.
    if (sort !== 'id' && !this.canQueryField(resource, actor, ability, sort))
      throw new KitError(403, 'E_FIELD_FORBIDDEN', 'Forbidden sort field')
    const sortColumn = `r.${resource.fields[sort]?.column ?? columnName(sort)}`
    const query = accessibleBy(
      this.db(`${name} as r`).whereNull('r.deleted_at'),
      ability,
      actor,
      'view',
      resource
    )
    query.select(this.columns(resource, ability, false, [sort]))
    if (resource.scoped) query.select('ou.path as org_path')
    if (options.search) {
      const searchable = Object.entries(resource.fields).filter(([, f]) => f.searchable)
      if (
        !searchable.length ||
        searchable.some(([key]) => !this.canQueryField(resource, actor, ability, key))
      )
        throw new KitError(403, 'E_SEARCH', 'Search is unavailable')
      query.whereRaw("r.search_vector @@ plainto_tsquery('simple', ?)", [options.search])
    }
    for (const [key, value] of Object.entries(options.filters ?? {})) {
      if (!resource.fields[key]?.filterable || !this.canQueryField(resource, actor, ability, key))
        throw new KitError(422, 'E_FILTER', 'Unsupported filter')
      if (value !== null && !['string', 'number', 'boolean'].includes(typeof value))
        throw new KitError(422, 'E_FILTER', 'Invalid filter value')
      query.where(`r.${resource.fields[key].column ?? columnName(key)}`, value as string)
    }
    if (options.tag !== undefined && options.tag !== null && options.tag !== '') {
      if (typeof options.tag !== 'string' || options.tag.length > 60)
        throw new KitError(422, 'E_FILTER', 'Invalid tag filter')
      query.whereExists((exists) =>
        exists
          .from('taggables as tg')
          .join('tags as tn', 'tn.id', 'tg.tag_id')
          .where('tg.resource', name)
          .whereRaw('tg.record_id = r.id')
          .where('tn.name', options.tag as string)
      )
    }
    // Estimate the authorized, filtered query, never the deployment-wide table cardinality.
    // Only the first page pays for the extra planner round trip; later pages keep its figure.
    let estimatedTotal: number | undefined
    if (options.estimate !== false && !options.cursor) {
      const compiled = query.clone().clearSelect().select('r.id').toSQL()
      const estimate = await this.db.raw(`EXPLAIN (FORMAT JSON) ${compiled.sql}`, [
        ...compiled.bindings,
      ])
      estimatedTotal = Number(estimate.rows[0]['QUERY PLAN'][0].Plan['Plan Rows'])
    }
    if (options.cursor) {
      let cursor: { id: number; value: unknown; sort: string; direction: string }
      try {
        cursor = JSON.parse(Buffer.from(options.cursor, 'base64url').toString())
      } catch {
        throw new KitError(422, 'E_CURSOR', 'Invalid cursor')
      }
      if (
        cursor.sort !== sort ||
        cursor.direction !== direction ||
        !Number.isSafeInteger(cursor.id) ||
        (cursor.value !== null && !['number', 'string', 'boolean'].includes(typeof cursor.value))
      )
        throw new KitError(422, 'E_CURSOR', 'Invalid cursor')
      query.where((q) => {
        if (cursor.value === null)
          q.whereNull(sortColumn).andWhere('r.id', direction === 'asc' ? '>' : '<', cursor.id)
        else
          q.where(sortColumn, direction === 'asc' ? '>' : '<', cursor.value as string)
            .orWhere((same) =>
              same
                .where(sortColumn, cursor.value as string)
                .andWhere('r.id', direction === 'asc' ? '>' : '<', cursor.id)
            )
            .orWhereNull(sortColumn)
      })
    }
    query.orderBy(sortColumn, direction, 'last')
    if (sort !== 'id') query.orderBy('r.id', direction)
    const rows = await query.limit(limit + 1)
    const records: RecordData[] = rows
      .slice(0, limit)
      .map((row: RecordData) => fromRow(row, resource))
    const last = records.at(-1)
    if (estimatedTotal !== undefined) {
      estimatedTotal =
        !options.cursor && rows.length <= limit
          ? rows.length
          : Math.max(estimatedTotal, rows.length)
    }
    const hydrated = await this.hydrate(this.db, resource, records)
    return {
      data: hydrated.map((record) => serialize(resource, record, ability, actor)),
      permissions: Object.fromEntries(
        records.map((record) => [
          String(record.id),
          this.permissions(resource, record, actor, ability),
        ])
      ),
      meta: {
        limit,
        estimatedTotal,
        nextCursor:
          rows.length > limit && last
            ? Buffer.from(
                JSON.stringify({ id: last.id, value: last[sort] ?? null, sort, direction })
              ).toString('base64url')
            : null,
      },
      related: await this.preload(resource, records, actor),
    }
  }
  private canQueryField(resource: Resource, actor: Actor, ability: KitAbility, key: string) {
    return canQueryField(resource, actor, ability, key)
  }
  private async preload(resource: Resource, records: RecordData[], actor: Actor) {
    const related: Record<string, SerializedRecord[]> = {}
    const ability = buildAbility(actor.rules, this.registry.all())
    for (const [key, field] of Object.entries(resource.fields)) {
      if (field.type !== 'belongsTo' || !records.length) continue
      const target = this.registry.get(field.resource)
      if (!ability.can('view', target.name)) continue
      const ids = records
        .filter((record) => key in serialize(resource, record, ability, actor))
        .map((record) => record[key])
        .filter((v) => v !== null && v !== undefined) as number[]
      if (!ids.length) continue
      const query = accessibleBy(
        this.db(`${target.name} as r`).whereIn('r.id', ids).whereNull('r.deleted_at'),
        ability,
        actor,
        'view',
        target
      ).select(this.columns(target, ability))
      if (target.scoped) query.select('ou.path as org_path')
      const rows = await query
      const targets = await this.hydrate(
        this.db,
        target,
        rows.map((r: RecordData) => fromRow(r, target))
      )
      related[key] = targets.map((r) => serialize(target, r, ability, actor))
    }
    return related
  }
  async show(name: string, id: number, actor: Actor) {
    const resource = this.registry.get(name)
    const ability = this.authorizeAction(resource, actor, 'view')
    const record = await this.find(this.db, resource, actor, ability, id)
    this.requireRecord(ability, actor, resource, 'view', record)
    const [hydrated] = await this.hydrate(this.db, resource, [record])
    return {
      data: serialize(resource, hydrated, ability, actor),
      permissions: this.permissions(resource, record, actor, ability),
      related: await this.preload(resource, [record], actor),
    }
  }
  async relationOptions(
    name: string,
    key: string,
    actor: Actor,
    options: { id?: number; search?: string; cursor?: string } = {}
  ) {
    const editor = await this.editor(name, actor, options.id)
    const field = editor.fields.find((entry) => entry.key === key)
    if (!field || field.type !== 'belongsTo')
      throw new KitError(403, 'E_FIELD_FORBIDDEN', 'ليس لديك صلاحية لهذا الحقل')
    const target = this.registry.get(field.resource)
    const page = await this.list(target.name, actor, {
      search: options.search,
      cursor: options.cursor,
      limit: 50,
      estimate: false,
    })
    return {
      data: page.data.map((row) => ({
        value: String(row.id),
        label: String(row[target.list[0]] ?? row.id),
      })),
      nextCursor: page.meta.nextCursor,
    }
  }

  /** Deferred relation reads re-authorize the parent and each child on every request. */
  async children(name: string, id: number, actor: Actor) {
    const resource = this.registry.get(name)
    const ability = this.authorizeAction(resource, actor, 'view')
    const parent = await this.find(this.db, resource, actor, ability, id)
    this.requireRecord(ability, actor, resource, 'view', parent)
    const result: Record<string, { rows: SerializedRecord[]; hasMore: boolean }> = {}
    for (const key of resource.show) {
      const field = resource.fields[key]
      if (
        field.type !== 'hasMany' ||
        !ability.can('view', subject(name, parent), key) ||
        actor.permissionLevel <
          Math.max(field.permissionLevel ?? 0, resource.hidden?.includes(key) ? 1 : 0)
      )
        continue
      if (resource.serialize && !resource.serialize.includes(key)) continue
      const child = this.registry.get(field.resource)
      if (!ability.can('view', child.name) || !child.actions.includes('view')) continue
      const rows = await accessibleBy(
        this.db(`${child.name} as r`).whereNull('r.deleted_at'),
        ability,
        actor,
        'view',
        child
      )
        .where(`r.${child.fields[field.foreignKey].column ?? columnName(field.foreignKey)}`, id)
        .select([...this.columns(child, ability), ...(child.scoped ? ['ou.path as org_path'] : [])])
        .orderBy('r.id')
        .limit(101)
      const children = await this.hydrate(
        this.db,
        child,
        rows.slice(0, 100).map((row: RecordData) => fromRow(row, child))
      )
      result[key] = {
        rows: children.map((row) => serialize(child, row, ability, actor)),
        hasMore: rows.length > 100,
      }
    }
    return result
  }
  /** Active lookup labels for the lookup fields the actor may read on this resource. */
  async lookups(name: string, actor: Actor) {
    const options: Record<string, { value: string; label: string }[]> = {}
    for (const field of this.describe(name, actor).fields) {
      if (field.type !== 'lookup') continue
      const rows = await this.db('lookups')
        .where({ group: field.group, active: true })
        .orderBy(['sort', 'id'])
        .select('key', 'label_ar')
      options[field.key] = rows.map((row) => ({ value: row.key, label: row.label_ar }))
    }
    return options
  }
  /** The last 50 recorded mutations of one record, after authorizing the record itself. */
  async activity(name: string, id: number, actor: Actor) {
    const resource = this.registry.get(name)
    const ability = this.authorizeAction(resource, actor, 'view')
    const record = await this.find(this.db, resource, actor, ability, id)
    this.requireRecord(ability, actor, resource, 'view', record)
    const rows = await this.db('activities as a')
      .leftJoin('users as u', 'u.id', 'a.actor_id')
      .where({ 'a.resource': name, 'a.record_id': id })
      .orderBy('a.id', 'desc')
      .limit(50)
      .select(
        'a.id',
        'a.action',
        'a.changes',
        'a.actor_id',
        'a.created_at',
        'u.full_name as actor_name'
      )
    return rows.map((row) => ({
      id: Number(row.id),
      action: String(row.action) as Action,
      fields: Array.isArray(row.changes?.fields) ? (row.changes.fields as string[]) : [],
      actorId: Number(row.actor_id),
      // A display name only: record viewers need not be able to read account e-mails.
      actorName: row.actor_name ? String(row.actor_name) : null,
      /**
       * @deprecated Always null. Kept so project-owned copies of resource-show from
       * earlier releases still compile; they fall back to the actor id.
       */
      actorEmail: null as string | null,
      createdAt: new Date(row.created_at).toISOString(),
    }))
  }
  async editor(name: string, actor: Actor, id?: number) {
    const resource = this.registry.get(name)
    const action = id === undefined ? 'create' : 'update'
    const ability = this.authorizeAction(resource, actor, action)
    const record =
      id === undefined ? undefined : await this.find(this.db, resource, actor, ability, id)
    if (record) {
      this.requireRecord(ability, actor, resource, action, record)
      if (resource.submittable && record.docStatus !== 0)
        throw new KitError(409, 'E_DOCUMENT_LOCKED', 'Only draft documents can be edited')
    }
    const fields = resource.form
      .filter((key) => {
        const field = resource.fields[key]
        return (
          !field.sequence &&
          actor.permissionLevel >=
            Math.max(field.permissionLevel ?? 0, resource.hidden?.includes(key) ? 1 : 0) &&
          ability.can(action, record ? subject(name, record) : name, key)
        )
      })
      .map((key) => ({ key, ...resource.fields[key] }))
    const options: Record<string, { value: string; label: string }[]> = {}
    const relationSearch: Record<string, boolean> = {}
    const inline: Record<
      string,
      {
        rows: SerializedRecord[]
        hasMore: boolean
        canCreate: boolean
        permissions: Record<string, { update: boolean; delete: boolean }>
        fields: ResourceField[]
        createFields: string[]
        updateFields: Record<string, string[]>
      }
    > = {}
    for (const field of fields) {
      if (field.type === 'hasMany' && field.inline) {
        const child = this.registry.get(field.resource)
        const rows: RecordData[] =
          record && ability.can('view', child.name)
            ? await accessibleBy(
                this.db(`${child.name} as r`).whereNull('r.deleted_at'),
                ability,
                actor,
                'view',
                child
              )
                .where(
                  `r.${child.fields[field.foreignKey].column ?? columnName(field.foreignKey)}`,
                  id
                )
                .select([
                  ...this.columns(child, ability),
                  ...(child.scoped ? ['ou.path as org_path'] : []),
                ])
                .orderBy('r.id')
                .limit(101)
            : []
        const records = rows.slice(0, 100).map((row) => fromRow(row, child))
        const hydratedRows = await this.hydrate(this.db, child, records)
        const childFields = child.form.filter(
          (key) =>
            key !== field.foreignKey &&
            !child.fields[key].sequence &&
            actor.permissionLevel >=
              Math.max(child.fields[key].permissionLevel ?? 0, child.hidden?.includes(key) ? 1 : 0)
        )
        inline[field.key] = {
          fields: childFields.map((key) => ({ key, ...child.fields[key] })),
          createFields: childFields.filter((key) => ability.can('create', child.name, key)),
          updateFields: Object.fromEntries(
            records.map((row) => [
              String(row.id),
              childFields.filter((key) => ability.can('update', subject(child.name, row), key)),
            ])
          ),
          rows: hydratedRows.map((row) => serialize(child, row, ability, actor)),
          hasMore: rows.length > 100,
          canCreate: child.actions.includes('create') && ability.can('create', child.name),
          permissions: Object.fromEntries(
            records.map((row) => [
              String(row.id),
              {
                update:
                  child.actions.includes('update') &&
                  ability.can('update', subject(child.name, row)),
                delete:
                  child.actions.includes('delete') &&
                  ability.can('delete', subject(child.name, row)),
              },
            ])
          ),
        }
      }
      if (field.type === 'lookup') {
        const lookups = await this.db('lookups')
          .where({ group: field.group, active: true })
          .orderBy('id')
          .select('key', 'label_ar')
        options[field.key] = lookups.map((row) => ({ value: row.key, label: row.label_ar }))
      } else if (field.type === 'belongsTo') {
        const target = this.registry.get(field.resource)
        if (ability.can('view', target.name)) {
          relationSearch[field.key] = this.describe(target.name, actor).searchable
          const page = await this.list(target.name, actor, { limit: 50, estimate: false })
          options[field.key] = page.data.map((row) => ({
            value: String(row.id),
            label: String(row[target.list[0]] ?? row.id),
          }))
          const selected = record?.[field.key]
          if (
            selected !== null &&
            selected !== undefined &&
            !options[field.key].some((option) => option.value === String(selected))
          ) {
            try {
              const current = await this.show(target.name, Number(selected), actor)
              options[field.key].push({
                value: String(current.data.id),
                label: String(current.data[target.list[0]] ?? current.data.id),
              })
            } catch (error) {
              if (!(error instanceof KitError) || ![403, 404].includes(error.status)) throw error
            }
          }
        } else options[field.key] = []
      }
    }
    const units = resource.scoped
      ? await this.db('org_units')
          .where((query) => {
            if (!actor.orgPaths.length) query.whereRaw('FALSE')
            for (const path of actor.orgPaths) query.orWhereRaw('path <@ ?::ltree', [path])
          })
          .orderBy('path')
          .limit(100)
          .select('id', 'name')
      : []
    if (record?.orgUnitId && !units.some((unit) => Number(unit.id) === Number(record.orgUnitId))) {
      const current = await this.db('org_units')
        .where('id', Number(record.orgUnitId))
        .first('id', 'name')
      if (current) units.push(current)
    }
    return {
      mode: action,
      name,
      label: resource.label.ar,
      fields,
      inline,
      options,
      relationSearch,
      orgUnits: units.map((row) => ({ value: String(row.id), label: String(row.name) })),
      scoped: resource.scoped,
      record: record
        ? serialize(resource, await this.hydrateOne(this.db, resource, record), ability, actor)
        : null,
    }
  }
  async save(
    name: string,
    actor: Actor,
    input: RecordData,
    id?: number,
    transaction?: Knex.Transaction
  ): Promise<SerializedRecord> {
    return this.persist(name, actor, input, id, transaction)
  }
  private async persist(
    name: string,
    actor: Actor,
    input: RecordData,
    id?: number,
    transaction?: Knex.Transaction,
    parentWrite?: { name: string; id: number; action: 'create' | 'update' }
  ): Promise<SerializedRecord> {
    const resource = this.registry.get(name)
    const action = id === undefined ? 'create' : 'update'
    const ability = this.authorizeAction(resource, actor, action)
    const form = writableInput(resource, input)
    const validated = await resource.validator.validate(form)
    const work = async (trx: Knex.Transaction) => {
      const existing =
        id === undefined ? {} : await this.find(trx, resource, actor, ability, id, true)
      if (id !== undefined) {
        this.requireRecord(ability, actor, resource, action, existing)
        this.requireVersion(resource, existing, input.version)
        if (resource.submittable && existing.docStatus !== 0)
          throw new KitError(409, 'E_DOCUMENT_LOCKED', 'Only draft documents can be edited')
      }
      const candidate: RecordData = {
        ...existing,
        ...validated,
        createdBy: existing.createdBy ?? actor.id,
        updatedBy: actor.id,
      }
      if (resource.submittable) candidate.docStatus = existing.docStatus ?? 0
      this.normalizeValues(resource, candidate)
      if (resource.scoped) {
        candidate.orgUnitId = input.orgUnitId ?? existing.orgUnitId
        const unit = await trx('org_units')
          .where('id', Number(candidate.orgUnitId) || -1)
          .first('path')
        candidate.orgPath = unit?.path
      }
      this.requireRecord(ability, actor, resource, action, candidate)
      // Validators may add fields (defaults, transforms); those are written too, so check them.
      const written = new Set([
        ...Object.keys(form),
        ...Object.keys(validated).filter((key) => key in resource.fields),
      ])
      for (const key of written) {
        const field = resource.fields[key]
        if (
          !ability.can(action, subject(name, candidate), key) ||
          (id !== undefined && !ability.can(action, subject(name, existing), key)) ||
          actor.permissionLevel <
            Math.max(field.permissionLevel ?? 0, resource.hidden?.includes(key) ? 1 : 0)
        )
          throw new KitError(403, 'E_FIELD_FORBIDDEN', `Field is forbidden: ${key}`)
        if (field.sequence)
          throw new KitError(422, 'E_SEQUENCE_READONLY', 'Sequence fields are generated')
      }
      for (const [key, field] of Object.entries(resource.fields))
        if (field.sequence && id === undefined) candidate[key] = await sequence(trx, field.sequence)
      const context = { trx, userId: actor.id, action } as const
      await resource.hooks?.beforeSave?.(candidate, context)
      this.normalizeValues(resource, candidate)
      for (const [key, field] of Object.entries(resource.fields)) {
        if (
          field.required &&
          field.type !== 'hasMany' &&
          (candidate[key] === null || candidate[key] === undefined)
        )
          throw new KitError(422, 'E_REQUIRED', `Required field: ${key}`)
        if (field.type === 'belongsTo' && candidate[key] !== null && candidate[key] !== undefined) {
          const related = this.registry.get(field.resource)
          const target = await this.find(trx, related, actor, ability, Number(candidate[key]))
          this.requireRecord(ability, actor, related, 'view', target)
        }
        if (field.type === 'lookup' && candidate[key] !== null && candidate[key] !== undefined) {
          if (
            !(await trx('lookups')
              .where({ group: field.group, key: candidate[key], active: true })
              .first())
          )
            throw new KitError(422, 'E_LOOKUP', `Invalid lookup: ${key}`)
        }
        if (
          field.type === 'attachment' &&
          isAttachmentId(candidate[key]) &&
          (candidate[key] !== existing[key] ||
            (resource.scoped && Number(candidate.orgUnitId) !== Number(existing.orgUnitId)))
        )
          await claimAttachment(trx, {
            attachmentId: candidate[key],
            actor,
            resource: name,
            field: key,
            recordId: id,
            orgUnitId: resource.scoped ? Number(candidate.orgUnitId) : null,
            scoped: resource.scoped,
          })
      }
      if (resource.scoped) {
        const unit = await trx('org_units')
          .where('id', Number(candidate.orgUnitId) || -1)
          .first('path')
        candidate.orgPath = unit?.path
      }
      // Hooks may calculate fields, but may never move a record past authorization.
      this.requireRecord(ability, actor, resource, action, candidate)
      await this.requireInlineParents(trx, resource, actor, candidate, existing, parentWrite)
      if (
        id !== undefined &&
        resource.scoped &&
        Number(candidate.orgUnitId) !== Number(existing.orgUnitId)
      ) {
        for (const field of Object.values(resource.fields)) {
          if (field.type !== 'hasMany' || !field.inline) continue
          const child = this.registry.get(field.resource)
          if (
            await trx(child.name)
              .where(child.fields[field.foreignKey].column ?? columnName(field.foreignKey), id)
              .whereNull('deleted_at')
              .first('id')
          )
            throw new KitError(
              422,
              'E_INLINE_SCOPE',
              'Cannot change organization while inline rows exist'
            )
        }
      }
      const values: RecordData = { updated_by: actor.id, updated_at: trx.fn.now() }
      if (id === undefined) values.created_by = actor.id
      if (resource.scoped) values.org_unit_id = candidate.orgUnitId
      if (resource.version) values.version = id === undefined ? 1 : Number(existing.version) + 1
      for (const [key, field] of Object.entries(resource.fields)) {
        if (field.type !== 'hasMany' && key in candidate)
          values[field.column ?? columnName(key)] =
            field.type === 'json' ? JSON.stringify(candidate[key]) : candidate[key]
      }
      const [row] =
        id === undefined
          ? await trx(name).insert(values).returning('*')
          : await trx(name).where({ id }).update(values).returning('*')
      const saved: RecordData = { ...fromRow(row, resource), orgPath: candidate.orgPath }
      for (const [key, field] of Object.entries(resource.fields)) {
        if (field.type !== 'attachment' || !(key in candidate)) continue
        const next = isAttachmentId(candidate[key]) ? candidate[key] : null
        const previous = isAttachmentId(existing[key]) ? existing[key] : null
        if (next !== null && id === undefined)
          await claimAttachment(trx, {
            attachmentId: next,
            actor,
            resource: name,
            field: key,
            recordId: Number(row.id),
            orgUnitId: resource.scoped ? Number(candidate.orgUnitId) : null,
            scoped: resource.scoped,
          })
        if (previous !== null && previous !== next) await releaseAttachment(trx, previous)
      }
      for (const [key, field] of Object.entries(resource.fields)) {
        if (field.type !== 'hasMany' || !(key in form)) continue
        if (!field.inline || !Array.isArray(form[key]) || (form[key] as unknown[]).length > 100)
          throw new KitError(422, 'E_INLINE', 'Invalid inline rows (maximum 100)')
        const childResource = this.registry.get(field.resource)
        const seen = new Set<number>()
        for (const child of form[key] as RecordData[]) {
          if (!child || typeof child !== 'object' || Array.isArray(child))
            throw new KitError(422, 'E_INLINE', 'Inline rows must be objects')
          const { id: childId, _delete: remove, ...data } = child
          if (remove !== undefined && typeof remove !== 'boolean')
            throw new KitError(422, 'E_INLINE', 'Invalid deletion marker')
          if (childId !== undefined) {
            if (
              id === undefined ||
              !Number.isSafeInteger(childId) ||
              Number(childId) <= 0 ||
              seen.has(Number(childId))
            )
              throw new KitError(422, 'E_INLINE', 'Invalid or repeated inline record identifier')
            seen.add(Number(childId))
            const childAbility = this.authorizeAction(
              childResource,
              actor,
              remove ? 'delete' : 'update'
            )
            const owned = await this.find(
              trx,
              childResource,
              actor,
              childAbility,
              Number(childId),
              true
            )
            if (Number(owned[field.foreignKey]) !== Number(row.id))
              throw new KitError(404, 'E_NOT_FOUND', 'السجل غير موجود')
          }
          if (remove) {
            if (childId === undefined)
              throw new KitError(422, 'E_INLINE', 'Deleting an inline row requires its identifier')
            await this.transition(
              field.resource,
              Number(childId),
              actor,
              'delete',
              data.version,
              trx
            )
            continue
          }
          await this.persist(
            field.resource,
            actor,
            {
              ...data,
              [field.foreignKey]: row.id,
              ...(childResource.scoped ? { orgUnitId: candidate.orgUnitId } : {}),
            },
            childId === undefined ? undefined : Number(childId),
            trx,
            { name, id: Number(row.id), action }
          )
        }
      }
      const changes: FieldChange[] = []
      if (id !== undefined)
        for (const key of Object.keys(resource.fields)) {
          if (resource.fields[key].type === 'hasMany' || !(key in saved)) continue
          const before = existing[key] ?? null
          const after = saved[key] ?? null
          if (JSON.stringify(before) !== JSON.stringify(after))
            changes.push({ field: key, before, after })
        }
      await this.audit(trx, resource, actor, action, saved, Object.keys(form), changes)
      await resource.hooks?.afterSave?.(saved, context)
      return serialize(resource, await this.hydrateOne(trx, resource, saved), ability, actor)
    }
    return transaction ? work(transaction) : this.db.transaction(work)
  }
  private requireVersion(resource: Resource, existing: RecordData, version: unknown) {
    if (resource.version && (!Number.isSafeInteger(version) || version !== existing.version))
      throw new KitError(
        409,
        'E_VERSION_CONFLICT',
        'تم تعديل السجل بواسطة مستخدم آخر. حدّث الصفحة وحاول مجدداً.'
      )
  }
  /** Inline children share the parent's draft state, organization and update authority. */
  private async requireInlineParents(
    trx: Knex.Transaction,
    resource: Resource,
    actor: Actor,
    candidate: RecordData,
    existing: RecordData = {},
    parentWrite?: { name: string; id: number; action: 'create' | 'update' }
  ) {
    for (const parent of this.registry.all()) {
      for (const [key, field] of Object.entries(parent.fields)) {
        if (field.type !== 'hasMany' || !field.inline || field.resource !== resource.name) continue
        const parentId = candidate[field.foreignKey]
        if (parentId === undefined || parentId === null) continue
        if (
          existing[field.foreignKey] !== undefined &&
          Number(existing[field.foreignKey]) !== Number(parentId)
        )
          throw new KitError(
            422,
            'E_INLINE_PARENT',
            'Inline records cannot be moved to another parent'
          )
        const action =
          parentWrite?.name === parent.name && parentWrite.id === Number(parentId)
            ? parentWrite.action
            : 'update'
        const ability = this.authorizeAction(parent, actor, action)
        const record = await this.find(trx, parent, actor, ability, Number(parentId), true)
        this.requireRecord(ability, actor, parent, action, record)
        if (
          !ability.can(action, subject(parent.name, record), key) ||
          actor.permissionLevel <
            Math.max(field.permissionLevel ?? 0, parent.hidden?.includes(key) ? 1 : 0)
        )
          throw new KitError(403, 'E_FIELD_FORBIDDEN', 'ليس لديك صلاحية تعديل البنود')
        if (parent.submittable && record.docStatus !== 0)
          throw new KitError(409, 'E_DOCUMENT_LOCKED', 'Only draft document lines can be edited')
        if (
          parent.scoped &&
          resource.scoped &&
          Number(record.orgUnitId) !== Number(candidate.orgUnitId)
        )
          throw new KitError(
            422,
            'E_INLINE_SCOPE',
            'Inline records must use the parent organization'
          )
      }
    }
  }
  async transition(
    name: string,
    id: number,
    actor: Actor,
    action: 'delete' | 'submit' | 'cancel',
    version?: unknown,
    transaction?: Knex.Transaction
  ) {
    const resource = this.registry.get(name)
    const ability = this.authorizeAction(resource, actor, action)
    const work = async (trx: Knex.Transaction) => {
      const record = await this.find(trx, resource, actor, ability, id, true)
      this.requireRecord(ability, actor, resource, action, record)
      this.requireVersion(resource, record, version)
      await this.requireInlineParents(trx, resource, actor, record)
      const values: RecordData = { updated_by: actor.id, updated_at: trx.fn.now() }
      if (resource.version) values.version = Number(record.version) + 1
      if (action === 'delete') {
        if (resource.submittable && record.docStatus !== 0)
          throw new KitError(409, 'E_DOCUMENT_LOCKED', 'Only drafts can be deleted')
        values.deleted_at = trx.fn.now()
      } else {
        if (!resource.submittable || record.docStatus !== (action === 'submit' ? 0 : 1))
          throw new KitError(409, 'E_DOCUMENT_STATE', 'Invalid document transition')
        values.doc_status = action === 'submit' ? 1 : 2
      }
      const [row] = await trx(name).where({ id }).update(values).returning('*')
      const saved = fromRow(row, resource)
      await this.audit(trx, resource, actor, action, saved, [])
      return serialize(resource, await this.hydrateOne(trx, resource, saved), ability, actor)
    }
    return transaction ? work(transaction) : this.db.transaction(work)
  }
  /**
   * Amend-by-copy: a cancelled document is copied into a new draft that points to
   * it through amended_from_id, together with its inline lines. The original stays
   * cancelled and unchanged; sequence fields receive new numbers.
   */
  async amend(name: string, id: number, actor: Actor, transaction?: Knex.Transaction) {
    const resource = this.registry.get(name)
    if (!resource.submittable)
      throw new KitError(409, 'E_DOCUMENT_STATE', 'Only submittable documents can be amended')
    const ability = this.authorizeAction(resource, actor, 'amend')
    const work = async (trx: Knex.Transaction) => {
      const source = await this.find(trx, resource, actor, ability, id, true)
      this.requireRecord(ability, actor, resource, 'amend', source)
      if (source.docStatus !== 2)
        throw new KitError(409, 'E_DOCUMENT_STATE', 'Only cancelled documents can be amended')
      const existing = await trx(name)
        .where('amended_from_id', id)
        .whereNull('deleted_at')
        .first('id')
      if (existing)
        throw new KitError(409, 'E_ALREADY_AMENDED', 'تم تعديل هذا المستند بالنسخ من قبل')
      const values: RecordData = {
        created_by: actor.id,
        updated_by: actor.id,
        doc_status: 0,
        amended_from_id: id,
      }
      if (resource.scoped) values.org_unit_id = source.orgUnitId
      if (resource.version) values.version = 1
      const copied: string[] = []
      for (const [key, field] of Object.entries(resource.fields)) {
        if (field.type === 'hasMany' || !(key in source)) continue
        const column = field.column ?? columnName(key)
        if (field.sequence) values[column] = await sequence(trx, field.sequence)
        else if (field.type === 'attachment') continue
        else {
          values[column] = field.type === 'json' ? JSON.stringify(source[key]) : source[key]
          copied.push(key)
        }
      }
      const [row] = await trx(name).insert(values).returning('*')
      const saved: RecordData = { ...fromRow(row, resource), orgPath: source.orgPath }
      for (const field of Object.values(resource.fields)) {
        if (field.type !== 'hasMany' || !field.inline) continue
        const child = this.registry.get(field.resource)
        const foreign = child.fields[field.foreignKey].column ?? columnName(field.foreignKey)
        const lines = await trx(child.name).where(foreign, id).whereNull('deleted_at').orderBy('id')
        for (const line of lines) {
          const copy: RecordData = {
            created_by: actor.id,
            updated_by: actor.id,
            [foreign]: row.id,
          }
          if (child.scoped) copy.org_unit_id = line.org_unit_id
          if (child.version) copy.version = 1
          for (const [key, childField] of Object.entries(child.fields)) {
            const column = childField.column ?? columnName(key)
            if (
              key === field.foreignKey ||
              childField.type === 'hasMany' ||
              childField.type === 'attachment' ||
              !(column in line)
            )
              continue
            copy[column] = childField.sequence
              ? await sequence(trx, childField.sequence)
              : childField.type === 'json'
                ? JSON.stringify(line[column])
                : line[column]
          }
          const [inserted] = await trx(child.name).insert(copy).returning('id')
          await this.audit(
            trx,
            child,
            actor,
            'create',
            { id: inserted.id },
            Object.keys(child.fields)
          )
        }
      }
      await this.audit(trx, resource, actor, 'amend', saved, copied)
      return serialize(resource, await this.hydrateOne(trx, resource, saved), ability, actor)
    }
    return transaction ? work(transaction) : this.db.transaction(work)
  }

  private async audit(
    trx: Knex.Transaction,
    resource: Resource,
    actor: Actor,
    action: Action,
    record: RecordData,
    fields: string[],
    changes?: FieldChange[]
  ) {
    await recordMutation(trx, {
      module: this.registry.owner(resource.name),
      resource: resource.name,
      id: record.id,
      actorId: actor.id,
      impersonatorId: actor.impersonatorId,
      action,
      fields,
      changes,
    })
  }
}
