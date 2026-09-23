import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Additive: e-mail becomes a case-insensitive identity and records when its
 * ownership was proven (invitation, password recovery or a verified provider).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('users', (table) => {
      table.timestamp('email_verified_at', { useTz: true }).nullable()
    })
    this.defer(async (db) => {
      const duplicates = await db.rawQuery(
        'SELECT lower(email) AS email FROM users GROUP BY lower(email) HAVING count(*) > 1 LIMIT 5'
      )
      if (duplicates.rows.length)
        throw new Error(
          `Users differ only by e-mail letter case (${duplicates.rows
            .map((row: { email: string }) => row.email)
            .join(', ')}). Merge or rename them, then rerun this migration.`
        )
      await db.rawQuery('UPDATE users SET email = lower(email) WHERE email <> lower(email)')
      await db.rawQuery('CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email))')
    })
  }
  async down() {
    throw new Error('Use an expand/contract migration')
  }
}
