import { randomUUID } from 'node:crypto'
import type { Knex } from 'knex'
import { KitError } from '../admin/errors.js'
import { Settings } from '../services/settings.js'
import { logActivity } from './activity.js'

export const MAIL_TEST_KEY = 'mail.delivery_test'
export type MailTestState = {
  id: string
  recipient: string
  fingerprint: string
  status: 'sending' | 'pending' | 'confirmed' | 'not_received' | 'failed'
  requestedAt: string
  answeredAt?: string
}

/** Receipt is an administrator attestation, never inferred from SMTP acceptance. */
export class MailDeliveryTest {
  constructor(private db: Knex) {}

  async current(actorId: number, recipient: string, fingerprint: string) {
    const state = await new Settings(this.db).get<MailTestState>(
      MAIL_TEST_KEY,
      'user',
      String(actorId)
    )
    return state?.recipient === recipient && state.fingerprint === fingerprint ? state : null
  }

  async send(
    actorId: number,
    recipient: string,
    fingerprint: string,
    deliver: (id: string) => Promise<void>
  ) {
    const state: MailTestState = {
      id: randomUUID(),
      recipient,
      fingerprint,
      status: 'sending',
      requestedAt: new Date().toISOString(),
    }
    await this.db.transaction(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(?, ?)', [717012, actorId])
      const previous = await new Settings(trx).get<MailTestState>(
        MAIL_TEST_KEY,
        'user',
        String(actorId)
      )
      const cooldown = previous?.status === 'sending' ? 300_000 : 60_000
      if (previous && Date.now() - Date.parse(previous.requestedAt) < cooldown)
        throw new KitError(
          429,
          'E_MAIL_TEST_COOLDOWN',
          'انتظر قليلًا قبل إعادة إرسال البريد التجريبي'
        )
      await new Settings(trx).set(MAIL_TEST_KEY, state, 'user', String(actorId))
      await logActivity(trx, {
        resource: 'core.mail',
        recordId: actorId,
        actorId,
        action: 'test_requested',
        changes: { testId: state.id },
      })
    })
    let failed = false
    try {
      await deliver(state.id)
    } catch {
      failed = true
    }
    // Match the attempt so a delayed response cannot overwrite a newer test.
    await this.db.transaction(async (trx) => {
      await trx('settings')
        .where({ key: MAIL_TEST_KEY, scope: 'user', scope_id: String(actorId) })
        .whereRaw("value->>'id' = ?", [state.id])
        .update({ value: JSON.stringify({ ...state, status: failed ? 'failed' : 'pending' }) })
      await logActivity(trx, {
        resource: 'core.mail',
        recordId: actorId,
        actorId,
        action: failed ? 'test_send_failed' : 'test_send_accepted',
        changes: { testId: state.id },
      })
    })
    if (failed)
      throw new KitError(
        502,
        'E_MAIL_TEST_SEND',
        'تعذّر إرسال البريد التجريبي. راجع إعدادات البريد ثم أعد المحاولة.'
      )
  }

  async answer(
    actorId: number,
    recipient: string,
    fingerprint: string,
    id: unknown,
    received: unknown
  ) {
    if (typeof received !== 'boolean' || typeof id !== 'string')
      throw new KitError(422, 'E_MAIL_TEST_ANSWER', 'اختر هل وصلت الرسالة أم لم تصل')
    await this.db.transaction(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(?, ?)', [717012, actorId])
      const state = await new MailDeliveryTest(trx).current(actorId, recipient, fingerprint)
      if (
        !state ||
        state.id !== id ||
        state.status !== 'pending' ||
        Date.now() - Date.parse(state.requestedAt) > 86_400_000
      )
        throw new KitError(
          409,
          'E_MAIL_TEST_STALE',
          'هذه التجربة لم تعد قابلة للتأكيد. أرسل رسالة تجريبية جديدة.'
        )
      await new Settings(trx).set(
        MAIL_TEST_KEY,
        {
          ...state,
          status: received ? 'confirmed' : 'not_received',
          answeredAt: new Date().toISOString(),
        },
        'user',
        String(actorId)
      )
      await logActivity(trx, {
        resource: 'core.mail',
        recordId: actorId,
        actorId,
        action: received ? 'receipt_confirmed' : 'receipt_missing',
        changes: { testId: state.id },
      })
    })
  }
}
