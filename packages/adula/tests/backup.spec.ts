import { test } from '@japa/runner'
import { assessBackup, verifyBackup } from '../index.js'
import { db, setup } from './helpers.js'

const now = Date.parse('2026-09-17T12:00:00Z')
const files = ['database.dump', 'uploads.tar.gz', 'SHA256SUMS', 'COMPLETE'].map((name) => ({
  key: `adula/2026-09-17T10-00-00Z/${name}`,
  size: name === 'COMPLETE' ? 0 : 100,
  modifiedAt: '2026-09-17T10:00:00Z',
}))
test.group('Offsite backup monitoring', (group) => {
  group.setup(setup)
  test('requires recent nonempty artifacts and COMPLETE from the same snapshot', ({ assert }) => {
    assert.isTrue(assessBackup(files, now).healthy)
    assert.isFalse(assessBackup(files.slice(0, 2), now).healthy)
    assert.isFalse(
      assessBackup(
        files.map((file) => ({ ...file, size: 0 })),
        now
      ).healthy
    )
    assert.isFalse(assessBackup(files, now + 72 * 3600000).healthy)
    assert.isFalse(assessBackup(files, now - 72 * 3600000).healthy)
    assert.isFalse(
      assessBackup(
        files.map((file, index) => ({
          ...file,
          key: file.key.replace('10-00', `${11 + index}-00`),
        })),
        now
      ).healthy
    )
  })
  test('rejects a missing, stale or cross-snapshot completion marker', ({ assert }) => {
    assert.isFalse(assessBackup(files.slice(0, 3), now).healthy)
    const withoutMarker = files.slice(0, 3)
    const marker = files[3]
    assert.isFalse(
      assessBackup(
        [...withoutMarker, { ...marker, key: marker.key.replace('10-00', '11-00') }],
        now
      ).healthy
    )
    assert.isFalse(
      assessBackup([...withoutMarker, { ...marker, modifiedAt: '2026-09-14T10:00:00Z' }], now)
        .healthy
    )
  })
  test('isolates configured prefixes including siblings and nested deployments', ({ assert }) => {
    const prefix = 'adula/deployments/clinic'
    const scoped = files.map((file) => ({ ...file, key: file.key.replace('adula/', prefix + '/') }))
    assert.isTrue(assessBackup(scoped, now, prefix).healthy)
    assert.isFalse(assessBackup(files, now, prefix).healthy)
    assert.isFalse(assessBackup(scoped, now).healthy)
    assert.isFalse(assessBackup(scoped, now, prefix + '-other').healthy)
    const sibling = scoped.map((file) => ({
      ...file,
      key: file.key.replace(prefix, prefix + '-other'),
    }))
    assert.isFalse(assessBackup([...scoped.slice(0, 3), ...sibling], now, prefix).healthy)
    assert.throws(() => assessBackup(scoped, now, 'adula/../other'))
  })
  test('records failures and notifies administrators once until recovery', async ({ assert }) => {
    const [role] = await db('roles')
      .insert({ name: 'backup-admin', permission_level: 1 })
      .returning('id')
    await db('user_roles').insert({ role_id: role.id, user_id: 1 })
    const failed = async () => {
      throw new Error('Do not put provider credentials in notifications')
    }
    const unhealthy = await verifyBackup(db, failed, now)
    assert.isFalse(unhealthy.healthy)
    await verifyBackup(db, failed, now)
    assert.lengthOf(await db('notifications'), 1)
    const scoped = files.map((file) => ({
      ...file,
      key: file.key.replace('adula/', 'adula/site/'),
    }))
    const healthy = await verifyBackup(db, async () => scoped, now, 'adula/site')
    assert.isTrue(healthy.healthy)
    await verifyBackup(db, failed, now)
    const messages = await db('notifications')
    assert.lengthOf(messages, 2)
    assert.notInclude(messages[0].body, 'credentials')
  })
})
