import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, services } from '@adonisjs/drive'

/**
 * Files are private on every disk: downloads are served only through the
 * authorized attachment route, never by the disk itself. Paths stored in the
 * database are relative to the disk root so `adula:storage:migrate` can move
 * the files between disks without rewriting records.
 */
const driveConfig = defineConfig({
  default: env.get('DRIVE_DISK'),
  services: {
    local: services.fs({
      location: app.makePath('storage/uploads'),
      serveFiles: false,
      visibility: 'private',
    }),
    s3: services.s3({
      credentials: {
        accessKeyId: env.get('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey: env.get('AWS_SECRET_ACCESS_KEY') ?? '',
      },
      region: env.get('AWS_REGION') ?? 'auto',
      endpoint: env.get('AWS_ENDPOINT'),
      bucket: env.get('S3_BUCKET') ?? '',
      visibility: 'private',
      // Bucket policies and IAM control access when Object Ownership disables ACLs.
      supportsACL: false,
    }),
    // Test-only second filesystem disk: `adula:storage:migrate` is verified against a real move.
    ...(app.inTest
      ? {
          local_test_archive: services.fs({
            location: app.makePath('storage/uploads-test-archive'),
            serveFiles: false,
            visibility: 'private',
          }),
        }
      : {}),
  },
})

export default driveConfig

declare module '@adonisjs/drive/types' {
  export interface DriveDisks extends InferDriveDisks<typeof driveConfig> {}
}
