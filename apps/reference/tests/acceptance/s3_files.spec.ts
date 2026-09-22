import { test } from '@japa/runner'
import { createHash, randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import User from '#models/user'
import { seedActor } from '#tests/helpers/ui_fixtures'
import { migrateStorage } from '@adula/kit'

type FileEvidence = {
  id: number
  path: string
  disk: string
  size: number
  sha256: string
  recordId?: number
}
type Evidence = {
  files: FileEvidence[]
  owner?: number
  reader?: number
  outsider?: number
  limited?: number
  checks: string[]
}
const path = process.env.ADULA_S3_MANIFEST!
const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex')
const knex = () => db.connection().getWriteClient()
const read = async () => JSON.parse(await readFile(path, 'utf8')) as Evidence
const save = (data: Evidence) => writeFile(path, JSON.stringify(data, null, 2))

test('real S3 attachment authorization, disk migration and restored HTTP downloads', async ({
  client,
  assert,
}) => {
  if (process.env.ADULA_S3_PHASE === 'restored') {
    const data = await read()
    const reader = await User.findOrFail(data.reader!)
    const outsider = await User.findOrFail(data.outsider!)
    const limited = await User.findOrFail(data.limited!)
    for (const file of data.files) {
      const row = await knex()('attachments').where('id', file.id).first()
      assert.equal(row.disk, 's3')
      assert.equal(row.path, file.path)
      assert.equal(row.record_id, file.recordId)
      const record = await client
        .get(`/resources/orders/${file.recordId}`)
        .loginAs(reader)
        .header('Accept', 'application/json')
      record.assertStatus(200)
      assert.equal(record.body().data.contract.id, file.id)
      const download = await client.get(`/attachments/${file.id}`).loginAs(reader)
      download.assertStatus(200)
      assert.equal(hash(Buffer.from(download.text())), file.sha256)
      const foreign = await client.get(`/attachments/${file.id}`).loginAs(outsider)
      foreign.assertStatus(404)
      const hidden = await client.get(`/attachments/${file.id}`).loginAs(limited)
      hidden.assertStatus(404)
    }
    data.checks.push(
      'restored_database_bindings_and_s3_http_downloads',
      'restored_scope_and_field_denials'
    )
    await save(data)
    return
  }

  const data: Evidence = { files: [], checks: [] }
  await save(data)
  const owner = await seedActor([{ subject: 'all', action: 'manage' }])
  const reader = await seedActor([{ subject: 'all', action: 'view' }], {
    orgUnitId: owner.orgUnitId,
  })
  const outsider = await seedActor([{ subject: 'all', action: 'manage' }])
  const limited = await seedActor([{ subject: 'all', action: 'view' }], {
    orgUnitId: owner.orgUnitId,
  })
  await knex()('role_rules').insert({
    role_id: limited.roleId,
    subject: 'orders',
    action: 'view',
    fields: JSON.stringify(['contract']),
    inverted: true,
  })
  Object.assign(data, {
    owner: owner.user.id,
    reader: reader.user.id,
    outsider: outsider.user.id,
    limited: limited.user.id,
  })
  const contents = [
    Buffer.from(`مرفق قبول S3 ${randomUUID()}\n`),
    Buffer.alloc(65536, 'a'),
    Buffer.alloc(1048576, 'z'),
  ]
  for (const [index, content] of contents.entries()) {
    const upload = await client
      .post('/attachments')
      .loginAs(owner.user)
      .withCsrfToken()
      .header('Accept', 'application/json')
      .fields({ resource: 'orders', field: 'contract' })
      .file('file', content, { filename: `مرفق-${index}.txt`, contentType: 'text/plain' })
    upload.assertStatus(201)
    const row = await knex()('attachments').where('id', upload.body().data.id).first()
    const file: FileEvidence = {
      id: row.id,
      path: row.path,
      disk: row.disk,
      size: content.length,
      sha256: hash(content),
    }
    data.files.push(file)
    await save(data) // Cleanup knows every object created by this run, even if a later assertion fails.
    assert.equal(row.disk, 's3')
    assert.match(row.path, /^resources\/orders\/contract\/[0-9a-f-]{36}\.txt$/)
    const unbound = await client.get(`/attachments/${file.id}`).loginAs(reader.user)
    unbound.assertStatus(404)
    const order = await client
      .post('/resources/orders')
      .loginAs(owner.user)
      .withCsrfToken()
      .header('Accept', 'application/json')
      .json({ orgUnitId: owner.orgUnitId, notes: `S3 acceptance ${index}`, contract: file.id })
    order.assertStatus(201)
    file.recordId = order.body().data.id
    await save(data)
    const download = await client.get(`/attachments/${file.id}`).loginAs(reader.user)
    download.assertStatus(200)
    assert.equal(hash(Buffer.from(download.text())), file.sha256)
    const foreign = await client.get(`/attachments/${file.id}`).loginAs(outsider.user)
    foreign.assertStatus(404)
    const hidden = await client.get(`/attachments/${file.id}`).loginAs(limited.user)
    hidden.assertStatus(404)
    const anonymous = await client
      .get(`/attachments/${file.id}`)
      .header('Accept', 'application/json')
    anonymous.assertStatus(401)
  }
  data.checks.push(
    'real_s3_upload_and_binding',
    'authorized_byte_exact_downloads',
    'unbound_scope_field_and_anonymous_denials'
  )
  await save(data)
  const migrate = (from: string, to: string, dryRun = false) =>
    migrateStorage(knex(), {
      from,
      to,
      dryRun,
      disks: ['s3', 'local_test_archive'],
      use: (name) => drive.use(name as 's3' | 'local_test_archive'),
    })
  const preview = await migrate('s3', 'local_test_archive', true)
  assert.equal(preview.copied, 0)
  const toLocal = await migrate('s3', 'local_test_archive')
  assert.deepEqual(toLocal.failed, [])
  assert.equal(toLocal.copied, data.files.length)
  for (const file of data.files) {
    assert.equal(hash(await drive.use('local_test_archive').getBytes(file.path)), file.sha256)
    // Only UUID objects created above are removed; migration retains source objects by design.
    await drive.use('s3').delete(file.path)
  }
  const toS3 = await migrate('local_test_archive', 's3')
  assert.deepEqual(toS3.failed, [])
  assert.equal(toS3.copied, data.files.length)
  const repeated = await migrate('local_test_archive', 's3')
  assert.equal(repeated.total, 0)
  for (const file of data.files) {
    assert.equal(hash(await drive.use('s3').getBytes(file.path)), file.sha256)
    const stored = await knex()('attachments').where('id', file.id).first()
    assert.equal(stored.disk, 's3')
  }
  data.checks.push('s3_to_local_and_local_to_s3_migration', 'migration_dry_run_and_repeat')
  await save(data)
})
