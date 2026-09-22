import { BaseCommand, flags } from '@adonisjs/core/ace'
import { resolve, join, basename } from 'node:path'
import { createReadStream } from 'node:fs'
import { stat, writeFile } from 'node:fs/promises'
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

export default class BackupCreate extends BaseCommand {
  static commandName = 'backup:create'
  static description =
    'Create a consistent database and all-disk attachment snapshot; publish COMPLETE last'
  static options = { startApp: true }

  @flags.string({ required: true, description: 'New snapshot directory (must not exist)' })
  declare snapshot: string
  @flags.string({
    description: 'Offsite key prefix (defaults to adula/<snapshot directory name>/)',
  })
  declare prefix: string

  async run() {
    const { default: env } = await import('#start/env')
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const { Settings } = await import('@adula/kit')
    const { createSnapshot } = await import('#services/backup_snapshot')
    const { publishSnapshot } = await import('#services/backup_publish')
    const directory = resolve(this.snapshot)
    const bucket = env.get('BACKUP_S3_BUCKET')
    const prefix =
      this.prefix ?? `${env.get('BACKUP_S3_PREFIX') ?? 'adula'}/${basename(directory)}/`
    if (!/^adula\/[a-zA-Z0-9/_-]+\/$/.test(prefix) || prefix.includes('//'))
      throw new Error('Invalid offsite prefix')
    const client = bucket
      ? new S3Client({
          region: env.get('BACKUP_S3_REGION'),
          endpoint: env.get('BACKUP_S3_ENDPOINT'),
          credentials: {
            accessKeyId: env.get('BACKUP_S3_ACCESS_KEY_ID')!,
            secretAccessKey: env.get('BACKUP_S3_SECRET_ACCESS_KEY')!,
          },
        })
      : null
    try {
      if (client) {
        try {
          await client.send(new HeadObjectCommand({ Bucket: bucket, Key: prefix + 'COMPLETE' }))
          throw new Error('Refusing to overwrite a complete offsite snapshot')
        } catch (error) {
          if (
            (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404
          )
            throw error
        }
      }
      await createSnapshot(directory)
      if (client) {
        await publishSnapshot(directory, {
          exists: async () => {
            try {
              await client.send(new HeadObjectCommand({ Bucket: bucket, Key: prefix + 'COMPLETE' }))
              return true
            } catch (error) {
              if (
                (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode ===
                404
              )
                return false
              throw error
            }
          },
          put: async (name, path) => {
            const info = path ? await stat(path) : null
            await client.send(
              new PutObjectCommand({
                Bucket: bucket,
                Key: prefix + name,
                Body: path ? createReadStream(path) : '',
                ContentLength: info?.size ?? 0,
              })
            )
          },
          read: async (name) => {
            const response = await client.send(
              new GetObjectCommand({ Bucket: bucket, Key: prefix + name })
            )
            if (!response.Body) throw new Error('Missing offsite body: ' + name)
            return response.Body as AsyncIterable<Uint8Array>
          },
        })
        await new Settings(db.connection().getWriteClient()).set(
          'backup.lastOffsite',
          new Date().toISOString()
        )
      }
      await writeFile(join(directory, 'COMPLETE'), '')
      this.logger.success(`Backup complete: ${directory}`)
    } finally {
      client?.destroy()
    }
  }
}
