import { test } from '@japa/runner'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import drive from '@adonisjs/drive/services/main'
import app from '@adonisjs/core/services/app'
import { publishSnapshot } from '#services/backup_publish'
import {
  verifySnapshot,
  verifyAttachments,
  restoreAttachments,
  snapshotFiles,
} from '#services/backup_snapshot'

test.group('Operational snapshot safety', () => {
  test('scheduler can read snapshots and recovery mounts the configured local disk writable', async ({
    assert,
  }) => {
    const compose = await readFile(app.makePath('docker-compose.prod.yml'), 'utf8')
    const scheduler = compose.split('  scheduler:')[1].split('  postgres:')[0]
    assert.include(scheduler, 'backups:/backups:ro')
    assert.include(scheduler, 'uploads:/app/apps/reference/storage/uploads')
    const restore = await readFile(app.makePath('docker-compose.restore.yml'), 'utf8')
    assert.include(restore, 'uploads:/app/apps/reference/storage/uploads')
    assert.notInclude(restore, 'storage/uploads:ro')
    const backup = await readFile(app.makePath('deploy/backup.sh'), 'utf8')
    assert.include(backup, 'node ace.js backup:create')
    assert.include(backup, '${BACKUP_S3_PREFIX:-adula}/$stamp/')
    assert.notInclude(backup, 'touch "$directory/COMPLETE"')
    const dockerfile = await readFile(app.makePath('Dockerfile'), 'utf8')
    assert.include(dockerfile, 'deploy --prod --legacy --frozen-lockfile /runtime')
    assert.include(dockerfile, 'Non-portable workspace dependency')
    assert.include(dockerfile, '/runtime/node_modules ./node_modules')
    assert.notInclude(dockerfile, 'chown -R node:node /app')
  })
  test('publishes COMPLETE last and refuses failed, corrupted or already complete transfers', async ({
    assert,
  }) => {
    const directory = await mkdtemp(join(tmpdir(), 'adula-publish-'))
    try {
      for (const name of [...snapshotFiles, 'SHA256SUMS'])
        await writeFile(join(directory, name), `payload:${name}`)
      for (const failure of ['none', 'put', 'read', 'corrupt', 'exists', 'marker']) {
        const stored = new Map<string, Buffer>()
        const operations: string[] = []
        if (failure === 'exists') stored.set('COMPLETE', Buffer.alloc(0))
        const operation = () =>
          publishSnapshot(directory, {
            exists: async () => stored.has('COMPLETE'),
            put: async (name, path) => {
              operations.push(`put:${name}`)
              if (failure === 'put' && name === 'uploads.tar.gz') throw new Error('Upload failed')
              if (failure === 'marker' && name === 'COMPLETE') throw new Error('Marker failed')
              stored.set(name, path ? await readFile(path) : Buffer.alloc(0))
            },
            read: async (name) => {
              operations.push(`read:${name}`)
              if (failure === 'read') throw new Error('Download failed')
              return (async function* () {
                yield failure === 'corrupt' ? Buffer.from('corrupt') : stored.get(name)!
              })()
            },
          })
        if (failure === 'none') {
          await operation()
          assert.equal(operations.at(-1), 'put:COMPLETE')
          assert.deepEqual(
            operations.slice(0, -1),
            [...snapshotFiles, 'SHA256SUMS'].flatMap((name) => [`put:${name}`, `read:${name}`])
          )
        } else {
          await assert.rejects(operation)
          if (failure === 'exists') assert.deepEqual(operations, [])
          else assert.isFalse(stored.has('COMPLETE'))
        }
      }
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test('requires checksums for every artifact and rejects checksum traversal', async ({
    assert,
  }) => {
    const directory = await mkdtemp(join(tmpdir(), 'adula-checksums-'))
    try {
      await writeFile(join(directory, 'COMPLETE'), '')
      await writeFile(join(directory, 'SHA256SUMS'), '')
      await assert.rejects(() => verifySnapshot(directory))
      await writeFile(join(directory, 'SHA256SUMS'), `${'0'.repeat(64)}  ../database.dump\n`)
      await assert.rejects(() => verifySnapshot(directory), /Malformed/)
      for (const name of ['database.dump', 'uploads.tar.gz'])
        await writeFile(join(directory, name), '')
      const hash = createHash('sha256').update('').digest('hex')
      await writeFile(
        join(directory, 'SHA256SUMS'),
        `${hash}  database.dump\n${hash}  uploads.tar.gz\n`
      )
      assert.isNull(await verifySnapshot(directory))
      await writeFile(join(directory, 'attachments.json'), '{"version":1,"files":[]}')
      await assert.rejects(() => verifySnapshot(directory), /Manifest checksum/)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test('validates all files against restored rows, restores original bytes and isolates the drill', async ({
    assert,
  }) => {
    const directory = await mkdtemp(join(tmpdir(), 'adula-files-'))
    const path = `restore-tests/${directory.split(/[\\/]/).at(-1)}.txt`
    const bytes = Buffer.from('مرفق النسخة الاحتياطية')
    const files = [
      {
        id: 1,
        disk: 'local_test_archive',
        path,
        size: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      },
    ]
    const disk = drive.use('local_test_archive' as 'local')
    try {
      await writeFile(join(directory, '1.bin'), bytes)
      await verifyAttachments(files, directory, files)
      await assert.rejects(() => verifyAttachments(files, directory, []), /inventory/)
      await assert.rejects(
        () => verifyAttachments(files, directory, [{ ...files[0], path: 'other' }]),
        /differs/
      )
      await disk.put(path, 'existing bytes')
      await restoreAttachments(files, directory, true)
      assert.equal(await disk.get(path), 'existing bytes')
      await restoreAttachments(files, directory, false)
      assert.deepEqual(Buffer.from(await disk.get(path)), bytes)
      await writeFile(join(directory, '1.bin'), Buffer.alloc(bytes.length))
      await assert.rejects(() => verifyAttachments(files, directory, files), /checksum mismatch/)
    } finally {
      await disk.delete(path)
      await rm(directory, { recursive: true, force: true })
    }
  })
})
