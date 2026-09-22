import { randomUUID } from 'node:crypto'
import type { Knex } from 'knex'
import { Settings } from '../services/settings.js'
import { KitError } from '../admin/errors.js'
import { logActivity } from './activity.js'

export type SetupCheck = {
  status: 'checking' | 'passed' | 'failed'
  checkedAt: string
  fingerprint: string
  attempt: string
}
export class InitialSetup {
  constructor(private db: Knex) {}

  async check(
    actorId: number,
    name: 'storage' | 'infrastructure',
    fingerprint: string,
    probe: () => Promise<void>
  ) {
    const key = `setup.check.${name}`
    const state: SetupCheck = {
      status: 'checking',
      checkedAt: new Date().toISOString(),
      fingerprint,
      attempt: randomUUID(),
    }
    await this.db.transaction(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [717013])
      const previous = await new Settings(trx).get<SetupCheck>(key)
      if (
        previous &&
        Date.now() - Date.parse(previous.checkedAt) <
          (previous.status === 'checking' ? 300_000 : 30_000)
      )
        throw new KitError(429, 'E_SETUP_COOLDOWN', 'انتظر قليلًا قبل إعادة الفحص')
      await new Settings(trx).set(key, state)
    })
    try {
      await probe()
      state.status = 'passed'
    } catch {
      state.status = 'failed'
    }
    await this.db.transaction(async (trx) => {
      await trx('settings')
        .where({ key, scope: 'system', scope_id: '0' })
        .whereRaw("value->>'attempt' = ?", [state.attempt])
        .update({ value: JSON.stringify(state) })
      await logActivity(trx, {
        resource: 'core.setup',
        recordId: 0,
        actorId,
        action: 'check',
        changes: { service: name, status: state.status },
      })
    })
    if (state.status === 'failed')
      throw new KitError(
        422,
        'E_SETUP_CHECK_FAILED',
        'لم ينجح الفحص. راجع إعدادات الخدمة واتصالها ثم أعد المحاولة.'
      )
  }

  async acknowledgeIdentity(actorId: number, fingerprint: string) {
    await this.db.transaction(async (trx) => {
      await new Settings(trx).set('setup.identity', {
        fingerprint,
        actorId,
        at: new Date().toISOString(),
      })
      await logActivity(trx, {
        resource: 'core.setup',
        recordId: 0,
        actorId,
        action: 'identity_confirmed',
      })
    })
  }

  async testNotification(actorId: number) {
    return this.db.transaction(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(?, ?)', [717014, actorId])
      const settings = new Settings(trx)
      const previous = await settings.get<{ id: number; at: string }>(
        'setup.notification',
        'user',
        String(actorId)
      )
      if (previous && Date.now() - Date.parse(previous.at) < 60_000)
        throw new KitError(429, 'E_SETUP_COOLDOWN', 'انتظر دقيقة قبل إعادة الإشعار التجريبي')
      const [notification] = await trx('notifications')
        .insert({
          user_id: actorId,
          title: 'اختبار الإشعارات',
          body: 'وصل هذا الإشعار من معالج الإعداد الأولي. حدده كمقروء ثم ارجع إلى الإعداد الأولي للتحقق من النتيجة.',
        })
        .returning('id')
      await settings.set(
        'setup.notification',
        { id: notification.id, at: new Date().toISOString() },
        'user',
        String(actorId)
      )
      await logActivity(trx, {
        resource: 'core.setup',
        recordId: notification.id,
        actorId,
        action: 'notification_test',
      })
      return notification.id as number
    })
  }
}
