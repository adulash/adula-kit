import { access, rename } from 'node:fs/promises'
import { join } from 'node:path'
import type { Knex } from 'knex'
import { AdulaError } from '../admin/errors.js'
import {
  LEGACY_DATABASE,
  LEGACY_FILES,
  LEGACY_MIGRATIONS_PATH,
  renamedMigration,
} from './legacy.js'

/**
 * Renames the `adonis_schema` rows a 1.x installation recorded under
 * `node_modules/@adula/<1.x name>/...` to the 2.0 paths, in one transaction. Lucid
 * would otherwise treat every core migration as pending. Idempotent: a renamed
 * database has no legacy rows. An unknown legacy row aborts without changes.
 */
export async function renameRecordedMigrations(knex: Knex, table = 'adonis_schema') {
  if (!(await knex.schema.hasTable(table))) return 0
  return knex.transaction(async (trx) => {
    const rows: { id: number; name: string }[] = await trx(table)
      .where('name', 'like', `${LEGACY_MIGRATIONS_PATH}/%`)
      .select('id', 'name')
      .forUpdate()
    const unknown = rows.filter((row) => !renamedMigration(row.name))
    if (unknown.length)
      throw new AdulaError(
        409,
        'E_UNKNOWN_MIGRATION',
        `Unknown 1.x migrations: ${unknown.map((row) => row.name).join(', ')}`
      )
    for (const row of rows)
      await trx(table)
        .where('id', row.id)
        .update({ name: renamedMigration(row.name) })
    return rows.length
  })
}

/** True while 1.x migration rows still wait for `adula:upgrade`. */
export async function hasLegacyMigrations(knex: Knex, table = 'adonis_schema') {
  if (!(await knex.schema.hasTable(table))) return false
  return Boolean(await knex(table).where('name', 'like', `${LEGACY_MIGRATIONS_PATH}/%`).first('id'))
}

/** Renames the 1.x gap log to GAPS.md unless the application already has one. */
export async function renameLegacyFiles(root: string) {
  const [legacy, current] = LEGACY_FILES.gaps
  const exists = (name: string) =>
    access(join(root, name)).then(
      () => true,
      () => false
    )
  if (!(await exists(legacy)) || (await exists(current))) return []
  await rename(join(root, legacy), join(root, current))
  return [`${legacy} -> ${current}`]
}

/**
 * Renames the database objects, setting and listener names 1.x created. Runs from
 * migration 016; every step is a no-op on a database created by 2.0.
 */
export async function renameLegacyDatabaseObjects(knex: Knex) {
  const [oldFunction, newFunction] = LEGACY_DATABASE.authFunction
  const [oldTrigger, newTrigger] = LEGACY_DATABASE.authTrigger
  const [oldSignal, newSignal] = LEGACY_DATABASE.notificationSignal
  const [, newChannel] = LEGACY_DATABASE.notificationChannel
  const [oldVersion, newVersion] = LEGACY_DATABASE.versionSetting
  const [oldPrefix, newPrefix] = LEGACY_DATABASE.listenerPrefix

  await knex.raw(`ALTER FUNCTION IF EXISTS ${oldFunction}() RENAME TO ${newFunction}`)
  const triggers = await knex('pg_trigger as t')
    .join('pg_class as c', 'c.oid', 't.tgrelid')
    .join('pg_namespace as n', 'n.oid', 'c.relnamespace')
    .where('t.tgname', oldTrigger)
    .whereRaw('n.nspname = current_schema()')
    .select('c.relname as table')
  for (const { table } of triggers)
    await knex.raw('ALTER TRIGGER ?? ON ?? RENAME TO ??', [oldTrigger, table, newTrigger])

  const signal = await knex('pg_proc as p')
    .join('pg_namespace as n', 'n.oid', 'p.pronamespace')
    .where('p.proname', oldSignal)
    .whereRaw('n.nspname = current_schema()')
    .first('p.oid')
  if (signal) {
    await knex.raw(
      `CREATE OR REPLACE FUNCTION ${newSignal}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_notify('${newChannel}', json_build_object('userId', NEW.user_id, 'id', NEW.id)::text); RETURN NULL; END $$`
    )
    await knex.raw(`DROP TRIGGER IF EXISTS ${oldSignal} ON notifications`)
    await knex.raw(
      `CREATE TRIGGER ${newSignal} AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION ${newSignal}()`
    )
    await knex.raw(`DROP FUNCTION ${oldSignal}()`)
  }

  await knex('settings')
    .where('key', oldVersion)
    .whereNotExists(
      knex('settings as current')
        .where('current.key', newVersion)
        .whereRaw('current.scope = settings.scope')
        .whereRaw('current.scope_id = settings.scope_id')
        .select(knex.raw('1'))
    )
    .update({ key: newVersion })
  await knex('settings').where('key', oldVersion).delete()

  await knex.raw(
    `UPDATE processed_events SET listener = ? || substr(listener, ?)
     WHERE listener LIKE ? AND NOT EXISTS (
       SELECT 1 FROM processed_events current
       WHERE current.event_id = processed_events.event_id
         AND current.listener = ? || substr(processed_events.listener, ?))`,
    [newPrefix, oldPrefix.length + 1, `${oldPrefix}%`, newPrefix, oldPrefix.length + 1]
  )
  await knex('processed_events').where('listener', 'like', `${oldPrefix}%`).delete()
}
