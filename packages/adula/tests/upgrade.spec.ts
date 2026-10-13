import { test } from '@japa/runner'
import { mkdtemp, readFile, rm, writeFile, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readdir } from 'node:fs/promises'
import { AdulaError } from '../index.js'
import { managedRules, syncAgentAssets } from '../src/commands/agent_assets.js'
import {
  LEGACY_DATABASE,
  LEGACY_FILES,
  LEGACY_MARKERS,
  LEGACY_MIGRATIONS_PATH,
  MIGRATIONS_BEFORE_2_0,
  MIGRATIONS_PATH,
  legacyMigrationFile,
} from '../src/upgrade/legacy.js'
import {
  hasLegacyMigrations,
  renameLegacyDatabaseObjects,
  renameLegacyFiles,
  renameRecordedMigrations,
} from '../src/upgrade/rename.js'
import { db, setup } from './helpers.js'

const TABLE = 'adonis_schema_upgrade_test'

/** Turns the 2.0 schema created by setup() back into what a 1.x installation left behind. */
async function downgradeToLegacyNames() {
  const [oldFunction, newFunction] = LEGACY_DATABASE.authFunction
  const [oldTrigger, newTrigger] = LEGACY_DATABASE.authTrigger
  const [oldSignal, newSignal] = LEGACY_DATABASE.notificationSignal
  const [oldChannel] = LEGACY_DATABASE.notificationChannel
  await db.raw(`ALTER FUNCTION ${newFunction}() RENAME TO ${oldFunction}`)
  for (const table of ['roles', 'role_rules', 'user_roles', 'user_org_units', 'org_units'])
    await db.raw('ALTER TRIGGER ?? ON ?? RENAME TO ??', [newTrigger, table, oldTrigger])
  await db.raw(`DROP TRIGGER ${newSignal} ON notifications`)
  await db.raw(`DROP FUNCTION ${newSignal}()`)
  await db.raw(
    `CREATE FUNCTION ${oldSignal}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_notify('${oldChannel}', json_build_object('userId', NEW.user_id, 'id', NEW.id)::text); RETURN NULL; END $$`
  )
  await db.raw(
    `CREATE TRIGGER ${oldSignal} AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION ${oldSignal}()`
  )
}

// Only this suite's schema: other schemas in the test database may hold either name.
const sorted = (values: string[]) => [...values].sort()
const objectNames = async () => ({
  functions: sorted(
    await db('pg_proc as p')
      .join('pg_namespace as n', 'n.oid', 'p.pronamespace')
      .whereRaw('n.nspname = current_schema()')
      .whereIn('p.proname', [
        ...LEGACY_DATABASE.authFunction,
        ...LEGACY_DATABASE.notificationSignal,
      ])
      .pluck('p.proname')
  ),
  triggers: sorted(
    await db('pg_trigger as t')
      .join('pg_class as c', 'c.oid', 't.tgrelid')
      .join('pg_namespace as n', 'n.oid', 'c.relnamespace')
      .whereRaw('n.nspname = current_schema()')
      .whereIn('t.tgname', [...LEGACY_DATABASE.authTrigger, ...LEGACY_DATABASE.notificationSignal])
      .pluck('t.tgname')
  ),
})

test.group('Upgrade from 1.x names', (group) => {
  group.setup(setup)

  test('migration history moves to the 2.0 paths in one idempotent transaction', async ({
    assert,
  }) => {
    await db.schema.dropTableIfExists(TABLE)
    await db.schema.createTable(TABLE, (t) => {
      t.increments('id')
      t.string('name')
      t.integer('batch')
    })
    const legacy = MIGRATIONS_BEFORE_2_0.map((name) => ({
      name: `${LEGACY_MIGRATIONS_PATH}/${legacyMigrationFile(name)}`,
      batch: 1,
    }))
    // `_` is a LIKE wildcard; a look-alike path must neither match nor abort the rename.
    const lookalike = `${LEGACY_MIGRATIONS_PATH.replace('_', 'x')}/1_other`
    await db(TABLE).insert([
      ...legacy,
      { name: 'database/migrations/1_create_users', batch: 1 },
      { name: lookalike, batch: 1 },
    ])
    assert.isTrue(await hasLegacyMigrations(db, TABLE))
    assert.equal(await renameRecordedMigrations(db, TABLE), MIGRATIONS_BEFORE_2_0.length)
    const names = await db(TABLE).orderBy('id').pluck('name')
    assert.deepEqual(names, [
      ...MIGRATIONS_BEFORE_2_0.map((name) => `${MIGRATIONS_PATH}/${name}`),
      'database/migrations/1_create_users',
      lookalike,
    ])
    assert.isFalse(await hasLegacyMigrations(db, TABLE))
    assert.equal(await renameRecordedMigrations(db, TABLE), 0)
  })

  test('an unknown 1.x migration aborts without renaming anything', async ({ assert }) => {
    await db(TABLE).del()
    const known = `${LEGACY_MIGRATIONS_PATH}/${legacyMigrationFile(MIGRATIONS_BEFORE_2_0[0])}`
    await db(TABLE).insert([
      { name: known, batch: 1 },
      { name: `${LEGACY_MIGRATIONS_PATH}/1779999999999_unreleased`, batch: 2 },
    ])
    const error = await renameRecordedMigrations(db, TABLE).catch((caught) => caught)
    assert.instanceOf(error, AdulaError)
    assert.equal(error.code, 'E_UNKNOWN_MIGRATION')
    assert.include(await db(TABLE).pluck('name'), known)
    await db.schema.dropTable(TABLE)
  })

  test('every shipped migration before 016 has a legacy name and no file keeps it', async ({
    assert,
  }) => {
    const entries = await readdir(new URL('../database/migrations/', import.meta.url))
    const files = entries
      .filter((file) => file.endsWith('.ts'))
      .map((file) => file.replace(/\.ts$/, ''))
      .filter((file) => file < '1770000000016')
    assert.deepEqual(files, [...MIGRATIONS_BEFORE_2_0])
    for (const file of files) assert.notEqual(legacyMigrationFile(file), file)
  })

  test('database objects, the version setting and listener names get AdulaJS names', async ({
    assert,
  }) => {
    await downgradeToLegacyNames()
    const [oldVersion, newVersion] = LEGACY_DATABASE.versionSetting
    const [oldPrefix, newPrefix] = LEGACY_DATABASE.listenerPrefix
    await db('settings').where('key', newVersion).del()
    await db('settings').insert({ key: oldVersion, value: JSON.stringify('1.2.0') })
    const event = '00000000-0000-4000-8000-000000000016'
    await db('processed_events').insert([
      { event_id: event, listener: `${oldPrefix}webhooks` },
      { event_id: event, listener: 'orders.audit' },
    ])
    const legacyObjects = await objectNames()
    assert.deepEqual(legacyObjects.functions, [
      LEGACY_DATABASE.authFunction[0],
      LEGACY_DATABASE.notificationSignal[0],
    ])

    await renameLegacyDatabaseObjects(db)
    await renameLegacyDatabaseObjects(db)

    assert.deepEqual(await objectNames(), {
      functions: [LEGACY_DATABASE.authFunction[1], LEGACY_DATABASE.notificationSignal[1]].sort(),
      triggers: [
        ...Array(5).fill(LEGACY_DATABASE.authTrigger[1]),
        LEGACY_DATABASE.notificationSignal[1],
      ].sort(),
    })
    assert.deepEqual(await db('settings').where('key', 'like', '%.version').pluck('key'), [
      newVersion,
    ])
    assert.deepEqual(
      sorted(await db('processed_events').where('event_id', event).pluck('listener')),
      [`${newPrefix}webhooks`, 'orders.audit']
    )
    // The renamed objects still work: role changes bump the authorization revision.
    const [{ version: before }] = await db('authorization_revision').select('version')
    await db('roles').insert({ name: 'upgrade-check', permission_level: 9 })
    const [{ version: after }] = await db('authorization_revision').select('version')
    assert.equal(Number(after), Number(before) + 1)
  })

  test('the 1.x gap log and managed AGENTS.md block are renamed once', async ({ assert }) => {
    const root = await mkdtemp(join(tmpdir(), 'adula-upgrade-'))
    try {
      const [legacyGaps, gaps] = LEGACY_FILES.gaps
      await writeFile(join(root, legacyGaps), '# Gaps\n')
      assert.deepEqual(await renameLegacyFiles(root), [`${legacyGaps} -> ${gaps}`])
      await access(join(root, gaps))
      assert.deepEqual(await renameLegacyFiles(root), [])

      const project = '## Project rules\nKeep our deployment.\n'
      await writeFile(
        join(root, 'AGENTS.md'),
        `${LEGACY_MARKERS.start} (managed) -->\nold rules\n${LEGACY_MARKERS.end}\n\n${project}`
      )
      await syncAgentAssets(root)
      const agents = await readFile(join(root, 'AGENTS.md'), 'utf8')
      assert.isNotEmpty(managedRules(agents))
      assert.notInclude(agents, LEGACY_MARKERS.start)
      assert.notInclude(agents, 'old rules')
      assert.include(agents, project)
      assert.equal(agents.split('<!-- adula:start').length, 2, 'one managed block')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
