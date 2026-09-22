import { test } from '@japa/runner'
import { execFile, spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import User from '#models/user'
import { Settings } from '@adula/kit'

const run = promisify(execFile)

function ace(args: string[]) {
  return new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ['ace', ...args], {
      cwd: app.appRoot,
      env: { ...process.env, NODE_ENV: 'test' },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    child.stdout?.on('data', (data) => {
      output += data
    })
    child.stderr?.on('data', (data) => {
      output += data
    })
    child.once('error', reject)
    child.once('exit', (code) => resolve({ code, output }))
  })
}

/** Same layout as deploy/backup.sh: database.dump, uploads.tar.gz, SHA256SUMS and COMPLETE. */
async function snapshot(root: string, uploads: string) {
  const stamp = new Date()
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\.\d+Z$/, 'Z')
  const directory = join(root, stamp)
  await mkdir(directory, { recursive: true })
  await run(
    'pg_dump',
    ['--format=custom', `--file=${join(directory, 'database.dump')}`, env.get('DB_DATABASE')],
    {
      windowsHide: true,
      timeout: 120000,
      env: {
        ...process.env,
        PGHOST: env.get('DB_HOST'),
        PGPORT: String(env.get('DB_PORT')),
        PGUSER: env.get('DB_USER'),
        PGPASSWORD: env.get('DB_PASSWORD'),
      },
    }
  )
  // GNU tar on Windows otherwise reads "C:\..." as a remote host.
  const forceLocal = process.platform === 'win32' ? ['--force-local'] : []
  await run('tar', [...forceLocal, '-czf', join(directory, 'uploads.tar.gz'), '-C', uploads, '.'], {
    windowsHide: true,
    timeout: 120000,
  })
  const sums: string[] = []
  for (const name of ['database.dump', 'uploads.tar.gz'])
    sums.push(
      `${createHash('sha256')
        .update(await readFile(join(directory, name)))
        .digest('hex')}  ${name}`
    )
  await writeFile(join(directory, 'SHA256SUMS'), `${sums.join('\n')}\n`)
  await writeFile(join(directory, 'COMPLETE'), '')
  return directory
}

test.group('Monthly restore drill', (group) => {
  let root: string
  let user: User
  let orgUnitId: number
  let attachmentId: number
  let orderId: number
  const knex = () => db.connection().getWriteClient()
  const leftovers = () =>
    knex()
      .select('datname')
      .from('pg_database')
      .where('datname', 'like', `${env.get('DB_DATABASE')}_restore_%`)

  group.setup(async () => {
    root = await mkdtemp(join(tmpdir(), 'adula-backups-'))
    const suffix = randomUUID()
    user = await User.create({
      fullName: 'مسؤول الاستعادة',
      email: `restore-${suffix}@example.test`,
      password: 'a-long-test-password-123',
    })
    const [org] = await knex()('org_units')
      .insert({
        name: 'وحدة الاستعادة',
        type: 'root',
        path: `restore_${suffix.replaceAll('-', '_')}`,
      })
      .returning('id')
    orgUnitId = org.id
    const [role] = await knex()('roles')
      .insert({ name: `restore-${suffix}`, permission_level: 1 })
      .returning('id')
    await knex()('role_rules').insert({ role_id: role.id, subject: 'all', action: 'manage' })
    await knex()('user_roles').insert({ user_id: user.id, role_id: role.id })
    await knex()('user_org_units').insert({ user_id: user.id, org_unit_id: org.id })
    await knex()('settings').where('key', 'backup.lastRestoreTest').delete()
    return async () => {
      await rm(root, { recursive: true, force: true })
      for (const row of await leftovers())
        await knex().raw('DROP DATABASE IF EXISTS ?? WITH (FORCE)', [row.datname])
    }
  })

  test('restores the latest snapshot, verifies the newest attachment file and records the drill', async ({
    client,
    assert,
  }) => {
    const suffix = randomUUID()
    const upload = await client
      .post('/attachments')
      .loginAs(user)
      .withCsrfToken()
      .header('Accept', 'application/json')
      .fields({ resource: 'orders', field: 'contract' })
      .file('file', Buffer.from(`%PDF-1.4\n% عقد الاستعادة ${suffix}\n`), {
        filename: 'عقد الاستعادة.pdf',
        contentType: 'application/pdf',
      })
    upload.assertStatus(201)
    attachmentId = upload.body().data.id
    const order = await client
      .post('/resources/orders')
      .loginAs(user)
      .withCsrfToken()
      .header('Accept', 'application/json')
      .json({ orgUnitId, notes: `طلب الاستعادة ${suffix}`, contract: attachmentId })
    order.assertStatus(201)
    orderId = order.body().data.id
    const directory = await snapshot(root, app.makePath('storage/uploads'))
    const result = await ace(['backup:restore-test', `--dir=${root}`])
    assert.equal(result.code, 0, result.output)
    const settings = new Settings(knex())
    const last = await settings.get<string>('backup.lastRestoreTest')
    assert.isString(last)
    assert.isBelow(Date.now() - Date.parse(last!), 120000)
    const report = await settings.get<Record<string, any>>('backup.lastRestoreTestReport')
    assert.equal(report!.status, 'passed')
    assert.equal(report!.snapshot, directory)
    assert.equal(report!.attachment.id, attachmentId)
    assert.equal(report!.attachment.recordId, orderId)
    assert.equal(report!.attachment.resource, 'orders')
    assert.equal(report!.attachment.field, 'contract')
    assert.isTrue(report!.attachment.fileVerified)
    assert.isAtLeast(report!.tables.orders, 1)
    assert.isAtLeast(report!.tables.attachments, 1)
    assert.include(report!.database, '_restore_')
    assert.deepEqual(await leftovers(), [])
  }).timeout(180000)

  test('fails loudly when the uploads archive lacks the attachment file and keeps the last success', async ({
    assert,
  }) => {
    const settings = new Settings(knex())
    const before = await settings.get<string>('backup.lastRestoreTest')
    assert.isString(before)
    const empty = await mkdtemp(join(tmpdir(), 'adula-empty-uploads-'))
    const brokenRoot = await mkdtemp(join(tmpdir(), 'adula-broken-'))
    const broken = await snapshot(brokenRoot, empty)
    try {
      const result = await ace(['backup:restore-test', `--snapshot=${broken}`])
      assert.equal(result.code, 1)
      assert.include(result.output, 'is missing from uploads.tar.gz')
      assert.equal(await settings.get<string>('backup.lastRestoreTest'), before)
      const report = await settings.get<Record<string, any>>('backup.lastRestoreTestReport')
      assert.equal(report!.status, 'failed')
      assert.include(report!.error, `Attachment ${attachmentId}`)
      assert.deepEqual(await leftovers(), [])
      await writeFile(join(broken, 'uploads.tar.gz'), 'tampered')
      const corrupt = await ace(['backup:restore-test', `--snapshot=${broken}`])
      assert.equal(corrupt.code, 1)
      assert.include(corrupt.output, 'Checksum mismatch for uploads.tar.gz')
      assert.equal(await settings.get<string>('backup.lastRestoreTest'), before)
      assert.deepEqual(await leftovers(), [])
    } finally {
      await rm(empty, { recursive: true, force: true })
      await rm(brokenRoot, { recursive: true, force: true })
    }
  }).timeout(180000)
})
