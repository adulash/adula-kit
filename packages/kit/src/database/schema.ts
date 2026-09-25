import type { Knex } from 'knex'
import type { Resource } from '../resource/types.js'
import { identifier, columnName } from '../resource/define_resource.js'

export async function createCoreSchema(db: Knex) {
  await db.raw('CREATE EXTENSION IF NOT EXISTS ltree WITH SCHEMA public')
  await db.schema.createTable('org_units', (t) => {
    t.increments('id')
    t.integer('parent_id').references('id').inTable('org_units').onDelete('RESTRICT')
    t.string('name').notNullable()
    t.string('type').notNullable()
    t.specificType('path', 'ltree').notNullable().unique()
  })
  await db.raw('CREATE INDEX org_units_path_gist ON org_units USING gist(path)')
  await db.schema.createTable('roles', (t) => {
    t.increments('id')
    t.string('name').notNullable().unique()
    t.integer('permission_level').notNullable().defaultTo(0)
  })
  await db.schema.createTable('role_rules', (t) => {
    t.increments('id')
    t.integer('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE').index()
    t.string('subject').notNullable()
    t.string('action').notNullable()
    t.jsonb('conditions')
    t.jsonb('fields')
    t.boolean('inverted').notNullable().defaultTo(false)
  })
  for (const name of ['user_roles', 'user_org_units']) {
    await db.schema.createTable(name, (t) => {
      t.increments('id')
      t.integer('user_id')
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
        .index()
      t.integer('org_unit_id').references('id').inTable('org_units').onDelete('RESTRICT').index()
      if (name === 'user_roles')
        t.integer('role_id')
          .notNullable()
          .references('id')
          .inTable('roles')
          .onDelete('RESTRICT')
          .index()
      else t.unique(['user_id', 'org_unit_id'])
    })
  }
  await db.schema.createTable('authorization_revision', (t) => {
    t.integer('id').primary()
    t.bigInteger('version').notNullable()
  })
  await db('authorization_revision').insert({ id: 1, version: 1 })
  await db.raw(
    `CREATE FUNCTION kit_bump_auth_revision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE authorization_revision SET version=version+1 WHERE id=1; RETURN NULL; END $$`
  )
  for (const table of ['roles', 'role_rules', 'user_roles', 'user_org_units', 'org_units'])
    await db.raw(
      `CREATE TRIGGER kit_invalidate_auth AFTER INSERT OR UPDATE OR DELETE ON ${table} FOR EACH STATEMENT EXECUTE FUNCTION kit_bump_auth_revision()`
    )
  await db.schema.createTable('settings', (t) => {
    t.increments('id')
    t.string('key').notNullable()
    t.string('scope').notNullable().defaultTo('system')
    t.string('scope_id').notNullable().defaultTo('0')
    t.jsonb('value').notNullable()
    t.unique(['key', 'scope', 'scope_id'])
  })
  await db.schema.createTable('lookups', (t) => {
    t.increments('id')
    t.string('group').notNullable()
    t.string('key').notNullable()
    t.string('label_ar').notNullable()
    t.string('label_en').notNullable()
    t.integer('sort').defaultTo(0)
    t.boolean('active').defaultTo(true)
    t.unique(['group', 'key'])
  })
  await db.schema.createTable('sequences', (t) => {
    t.string('key').primary()
    t.bigInteger('value').notNullable().defaultTo(0)
  })
  await db.schema.createTable('activities', (t) => {
    t.bigIncrements('id')
    t.string('resource').notNullable()
    t.integer('record_id').notNullable()
    t.integer('actor_id').notNullable().references('id').inTable('users')
    t.string('action').notNullable()
    t.jsonb('changes').notNullable()
    t.timestamp('created_at', { useTz: true }).defaultTo(db.fn.now())
    t.index(['resource', 'record_id'])
  })
  await db.schema.createTable('outbox', (t) => {
    t.uuid('id').primary()
    t.string('event').notNullable()
    t.jsonb('payload').notNullable()
    t.timestamp('created_at', { useTz: true }).defaultTo(db.fn.now())
    t.timestamp('published_at', { useTz: true })
    t.integer('attempts').notNullable().defaultTo(0)
    t.text('last_error')
    t.index(['published_at', 'created_at'])
  })
  await db.schema.createTable('processed_events', (t) => {
    t.uuid('event_id').notNullable()
    t.string('listener').notNullable()
    t.timestamp('processed_at', { useTz: true }).defaultTo(db.fn.now())
    t.primary(['event_id', 'listener'])
  })
  await db.schema.createTable('notifications', (t) => {
    t.increments('id')
    t.integer('user_id').notNullable().references('id').inTable('users').index()
    t.string('title').notNullable()
    t.text('body').notNullable()
    t.timestamp('read_at', { useTz: true })
    t.timestamp('created_at', { useTz: true }).defaultTo(db.fn.now())
  })
  await db.schema.createTable('workflow_runs', (t) => {
    t.uuid('id').primary()
    t.string('resource').notNullable()
    t.integer('record_id').notNullable()
    t.string('definition').notNullable()
    t.integer('definition_version').notNullable()
    t.jsonb('snapshot').notNullable()
    t.string('status').notNullable()
    t.timestamp('created_at', { useTz: true }).defaultTo(db.fn.now())
  })
}

/** Attachment metadata lives in one table so ownership, restore drills and disk moves see every file. */
export async function createAttachmentsSchema(db: Knex) {
  await db.schema.createTable('attachments', (t) => {
    t.increments('id')
    t.string('disk').notNullable()
    t.string('path', 1024).notNullable()
    t.string('name').notNullable()
    t.string('original_name').notNullable()
    t.bigInteger('size').notNullable()
    t.string('mime_type').notNullable()
    t.string('extname').notNullable()
    t.jsonb('data').notNullable()
    t.integer('uploaded_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT')
      .index()
    t.integer('org_unit_id').references('id').inTable('org_units').onDelete('RESTRICT').index()
    t.string('resource')
    t.integer('record_id')
    t.string('field')
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(db.fn.now())
    t.timestamp('deleted_at', { useTz: true })
    t.index(['resource', 'record_id', 'field'])
    t.index(['disk', 'deleted_at'])
  })
}

export async function createSavedViewsSchema(db: Knex) {
  await db.schema.createTable('saved_views', (t) => {
    t.increments('id')
    t.string('resource').notNullable()
    t.string('name').notNullable()
    t.jsonb('query').notNullable()
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    t.boolean('shared').notNullable().defaultTo(false)
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(db.fn.now())
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(db.fn.now())
    t.unique(['user_id', 'resource', 'name'])
    t.index(['resource', 'shared'])
  })
}

export async function createResourceTable(
  db: Knex,
  resource: Pick<
    Resource,
    'name' | 'scoped' | 'version' | 'submittable' | 'customFields' | 'fields'
  >
) {
  const table = identifier(resource.name)
  await db.schema.createTable(table, (t) => {
    t.increments('id')
    if (resource.scoped)
      t.integer('org_unit_id')
        .notNullable()
        .references('id')
        .inTable('org_units')
        .onDelete('RESTRICT')
        .index()
    for (const name of ['created_by', 'updated_by'])
      t.integer(name).notNullable().references('id').inTable('users').onDelete('RESTRICT').index()
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(db.fn.now())
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(db.fn.now())
    t.timestamp('deleted_at', { useTz: true })
    if (resource.version) t.integer('version').notNullable().defaultTo(1)
    if (resource.submittable) {
      t.smallint('doc_status').notNullable().defaultTo(0)
      t.integer('amended_from_id').references('id').inTable(table).onDelete('RESTRICT').index()
    }
    if (resource.customFields) t.jsonb('custom_fields').notNullable().defaultTo('{}')
    for (const [key, field] of Object.entries(resource.fields)) {
      if (field.type === 'hasMany') continue
      const name = field.column ?? columnName(key)
      let column: Knex.ColumnBuilder
      switch (field.type) {
        case 'belongsTo':
          column = t.integer(name)
          column.references('id').inTable(identifier(field.resource)).onDelete('RESTRICT').index()
          break
        case 'attachment':
          column = t.integer(name)
          column.references('id').inTable('attachments').onDelete('RESTRICT').index()
          break
        case 'integer':
          column = t.integer(name)
          break
        case 'money':
          column = t.bigInteger(name)
          break
        case 'boolean':
          column = t.boolean(name)
          break
        case 'date':
          column = t.date(name)
          break
        case 'datetime':
          column = t.timestamp(name, { useTz: true })
          break
        case 'json':
          column = t.jsonb(name)
          break
        case 'text':
          column = t.text(name)
          break
        default:
          column = t.string(name)
      }
      if (field.required || field.sequence) column.notNullable()
    }
    if (resource.scoped) t.index(['org_unit_id', 'deleted_at'])
  })
  for (const [key, field] of Object.entries(resource.fields)) {
    if (field.unique)
      await db.raw('CREATE UNIQUE INDEX ?? ON ?? (??) WHERE deleted_at IS NULL', [
        `${table}_${columnName(key)}_active_unique`,
        table,
        field.column ?? columnName(key),
      ])
  }
  const searchable = Object.entries(resource.fields).filter(([, f]) => f.searchable)
  if (searchable.length) {
    const expression = searchable
      .map(([key, field]) => `coalesce("${identifier(field.column ?? columnName(key))}", '')`)
      .join(` || ' ' || `)
    await db.raw(
      `ALTER TABLE "${table}" ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', ${expression})) STORED`
    )
    await db.raw('CREATE INDEX ?? ON ?? USING gin(search_vector)', [`${table}_search_gin`, table])
  }
}

/** Record collaboration (phase 3): comments with mentions, followers, tags and field history. */
export async function createCollaborationSchema(db: Knex) {
  await db.schema.createTable('comments', (t) => {
    t.bigIncrements('id')
    t.string('resource').notNullable()
    t.integer('record_id').notNullable()
    t.integer('author_id').notNullable().references('id').inTable('users').onDelete('RESTRICT')
    t.text('body').notNullable()
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(db.fn.now())
    t.timestamp('edited_at', { useTz: true })
    t.timestamp('deleted_at', { useTz: true })
    t.index(['resource', 'record_id', 'id'])
  })
  await db.schema.createTable('comment_mentions', (t) => {
    t.bigInteger('comment_id')
      .notNullable()
      .references('id')
      .inTable('comments')
      .onDelete('CASCADE')
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    t.primary(['comment_id', 'user_id'])
    t.index(['user_id'])
  })
  await db.schema.createTable('followers', (t) => {
    t.string('resource').notNullable()
    t.integer('record_id').notNullable()
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(db.fn.now())
    t.primary(['resource', 'record_id', 'user_id'])
    t.index(['user_id'])
  })
  await db.schema.createTable('tags', (t) => {
    t.increments('id')
    t.string('name', 60).notNullable().unique()
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(db.fn.now())
  })
  await db.schema.createTable('taggables', (t) => {
    t.integer('tag_id').notNullable().references('id').inTable('tags').onDelete('CASCADE')
    t.string('resource').notNullable()
    t.integer('record_id').notNullable()
    t.primary(['tag_id', 'resource', 'record_id'])
    t.index(['resource', 'record_id'])
  })
  await db.schema.createTable('field_changes', (t) => {
    t.bigIncrements('id')
    t.bigInteger('activity_id')
      .notNullable()
      .references('id')
      .inTable('activities')
      .onDelete('CASCADE')
      .index()
    t.string('resource').notNullable()
    t.integer('record_id').notNullable()
    t.string('field').notNullable()
    t.jsonb('before')
    t.jsonb('after')
    t.index(['resource', 'record_id', 'id'])
  })
}

/** Work assigned to a user on a record; approval steps of workflows reuse it (phase 4). */
export async function createAssignmentsSchema(db: Knex) {
  await db.schema.createTable('assignments', (t) => {
    t.bigIncrements('id')
    t.string('resource').notNullable()
    t.integer('record_id').notNullable()
    t.integer('assignee_id').notNullable().references('id').inTable('users').onDelete('RESTRICT')
    t.integer('assigned_by').references('id').inTable('users').onDelete('RESTRICT')
    t.string('kind', 20).notNullable().defaultTo('task')
    t.string('title', 200).notNullable()
    t.text('note')
    t.date('due_on')
    t.string('status', 20).notNullable().defaultTo('open')
    t.uuid('workflow_run_id')
    t.string('workflow_step', 100)
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(db.fn.now())
    t.timestamp('completed_at', { useTz: true })
    t.integer('completed_by').references('id').inTable('users').onDelete('RESTRICT')
    t.string('outcome', 20)
    t.index(['assignee_id', 'status', 'id'])
    t.index(['resource', 'record_id'])
    t.index(['workflow_run_id'])
  })
}
