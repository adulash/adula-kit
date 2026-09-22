import type { Knex } from 'knex'

export class Settings {
  constructor(private db: Knex) {}
  async get<T>(key: string, scope = 'system', scopeId = '0'): Promise<T | undefined> {
    const row = await this.db('settings').where({ key, scope, scope_id: scopeId }).first('value')
    return row?.value as T | undefined
  }
  async set(key: string, value: unknown, scope = 'system', scopeId = '0') {
    await this.db('settings')
      .insert({ key, scope, scope_id: scopeId, value: JSON.stringify(value) })
      .onConflict(['key', 'scope', 'scope_id'])
      .merge(['value'])
  }
}
export async function sequence(trx: Knex.Transaction, key: string) {
  const result = await trx.raw(
    'INSERT INTO sequences (key,value) VALUES (?,1) ON CONFLICT (key) DO UPDATE SET value=sequences.value+1 RETURNING value',
    [key]
  )
  return `${key}-${String(result.rows[0].value).padStart(6, '0')}`
}
export async function notify(db: Knex, userId: number, title: string, body: string) {
  await db('notifications').insert({ user_id: userId, title, body })
}
