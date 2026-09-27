import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import type { Knex } from 'knex'
import { KitError } from '../admin/errors.js'
import type { SecretBox } from './webhooks.js'

export type InboundSource = {
  id: number
  key: string
  name: string
  algorithm: 'sha256' | 'sha512'
  signatureHeader: string
  signaturePrefix: string
  eventHeader: string
  deliveryHeader: string
  active: boolean
  createdAt: string
  lastReceivedAt: string | null
  /** The path senders post to. */
  path: string
}
export type InboundSourceInput = {
  key?: unknown
  name?: unknown
  algorithm?: unknown
  signatureHeader?: unknown
  signaturePrefix?: unknown
  eventHeader?: unknown
  deliveryHeader?: unknown
  active?: unknown
}
export type InboundDelivery = {
  id: string
  deliveryId: string
  event: string
  eventName: string
  dispatches: number
  receivedAt: string
}
export type InboundReceipt = { delivery: string; event: string; duplicate: boolean }

/** Inbound payloads above this size are refused before verification. */
export const INBOUND_BODY_LIMIT = 1024 * 1024
const HEADER = /^[a-z0-9][a-z0-9-]{0,99}$/
const KEY = /^[a-z][a-z0-9_]{0,59}$/

/** The domain event an inbound delivery raises: inbound.<source>.<event>. */
export function inboundEventName(source: string, event: string) {
  const safe =
    event
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'received'
  return `inbound.${source}.${safe}`
}

/**
 * Signed inbound webhooks (#30). Administrators create a source per sender (for example
 * a Git host) and give it the generated secret. POST /webhooks/in/<key> verifies an
 * HMAC over the raw body in constant time (X-Hub-Signature-256 by default), stores each
 * delivery once by the sender's delivery id and raises inbound.<key>.<event> through the
 * outbox, so module listeners run idempotently with retries and a delivery history.
 */
export class InboundWebhooks {
  constructor(
    private db: Knex,
    private secrets: SecretBox
  ) {}

  async list(): Promise<InboundSource[]> {
    const rows = await this.db('inbound_sources').orderBy('id')
    return rows.map((row) => this.present(row))
  }

  /** Creates a source and returns its secret once; it is never shown again. */
  async create(actorId: number, input: InboundSourceInput) {
    const values = this.validate(input, true)
    if (await this.db('inbound_sources').where('key', values.key).first('id'))
      throw new KitError(409, 'E_INBOUND_KEY', 'يوجد مصدر بهذا المفتاح')
    const secret = randomBytes(32).toString('base64url')
    const [row] = await this.db('inbound_sources')
      .insert({ ...values, secret: this.secrets.seal(secret), created_by: actorId })
      .returning('*')
    return { source: this.present(row), secret }
  }

  /** Updates the name, headers or state; the key and secret stay. */
  async update(id: number, input: InboundSourceInput) {
    const values: Record<string, unknown> = this.validate(input, false)
    delete values.key
    const updated = await this.db('inbound_sources')
      .where('id', id)
      .update({ ...values, active: input.active !== false, updated_at: this.db.fn.now() })
    if (!updated) throw new KitError(404, 'E_INBOUND_NOT_FOUND', 'المصدر غير موجود')
  }

  /** Issues a new secret; the old one stops verifying at once. */
  async rotate(id: number) {
    const secret = randomBytes(32).toString('base64url')
    const updated = await this.db('inbound_sources')
      .where('id', id)
      .update({ secret: this.secrets.seal(secret), updated_at: this.db.fn.now() })
    if (!updated) throw new KitError(404, 'E_INBOUND_NOT_FOUND', 'المصدر غير موجود')
    return secret
  }

  async remove(id: number) {
    const removed = await this.db('inbound_sources').where('id', id).del()
    if (!removed) throw new KitError(404, 'E_INBOUND_NOT_FOUND', 'المصدر غير موجود')
  }

  /**
   * Verifies and records one delivery. Unknown or inactive sources and bad signatures
   * are refused without storing anything; a repeated delivery id is acknowledged once.
   */
  async receive(
    key: string,
    request: { headers: Record<string, string | string[] | undefined>; body: string | Buffer }
  ): Promise<InboundReceipt> {
    const body = Buffer.isBuffer(request.body) ? request.body : Buffer.from(request.body ?? '')
    if (body.length > INBOUND_BODY_LIMIT)
      throw new KitError(413, 'E_INBOUND_TOO_LARGE', 'Payload too large')
    const source =
      typeof key === 'string' && KEY.test(key)
        ? await this.db('inbound_sources').where({ key, active: true }).first()
        : undefined
    if (!source) throw new KitError(404, 'E_INBOUND_NOT_FOUND', 'Unknown webhook source')
    const header = (name: string) => {
      const value = request.headers[name.toLowerCase()]
      return Array.isArray(value) ? value[0] : value
    }
    const secret = this.secrets.open(String(source.secret))
    const signature = header(source.signature_header) ?? ''
    const expected = `${source.signature_prefix}${createHmac(
      source.algorithm,
      secret ?? randomBytes(32)
    )
      .update(body)
      .digest('hex')}`
    const given = Buffer.from(signature)
    const wanted = Buffer.from(expected)
    if (!secret || given.length !== wanted.length || !timingSafeEqual(given, wanted))
      throw new KitError(401, 'E_INBOUND_SIGNATURE', 'Invalid signature')
    let payload: unknown
    try {
      payload = JSON.parse(body.toString('utf8') || 'null')
    } catch {
      throw new KitError(400, 'E_INBOUND_BODY', 'The body must be JSON')
    }
    const eventName = (header(source.event_header) ?? 'received').slice(0, 100)
    // Senders without a delivery id are deduplicated by the body itself.
    const deliveryId = (
      header(source.delivery_header) ?? `sha256:${createHash('sha256').update(body).digest('hex')}`
    ).slice(0, 200)
    const event = inboundEventName(String(source.key), eventName)
    return this.db.transaction(async (trx) => {
      const eventId = randomUUID()
      const [stored] = await trx('inbound_deliveries')
        .insert({
          id: randomUUID(),
          source_id: source.id,
          delivery_id: deliveryId,
          event: eventName,
          payload: JSON.stringify(payload),
          event_id: eventId,
        })
        .onConflict(['source_id', 'delivery_id'])
        .ignore()
        .returning('id')
      if (!stored) return { delivery: deliveryId, event, duplicate: true }
      await trx('inbound_sources').where('id', source.id).update({ last_received_at: trx.fn.now() })
      await trx('outbox').insert({
        id: eventId,
        event,
        payload: JSON.stringify(this.envelope(source.key, deliveryId, eventName, payload)),
      })
      return { delivery: deliveryId, event, duplicate: false }
    })
  }

  async deliveries(sourceId: number, limit = 50): Promise<InboundDelivery[]> {
    const source = await this.db('inbound_sources').where('id', sourceId).first('key')
    if (!source) throw new KitError(404, 'E_INBOUND_NOT_FOUND', 'المصدر غير موجود')
    const rows = await this.db('inbound_deliveries')
      .where('source_id', sourceId)
      .orderBy('received_at', 'desc')
      .limit(Math.min(100, Math.max(1, limit)))
    return rows.map((row) => ({
      id: String(row.id),
      deliveryId: String(row.delivery_id),
      event: String(row.event),
      eventName: inboundEventName(String(source.key), String(row.event)),
      dispatches: Number(row.dispatches),
      receivedAt: new Date(row.received_at).toISOString(),
    }))
  }

  /**
   * Raises a stored delivery again as a new domain event, for listeners that failed or
   * were added later. Listeners must be idempotent on the delivery id.
   */
  async redispatch(deliveryId: string) {
    if (
      typeof deliveryId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deliveryId)
    )
      throw new KitError(404, 'E_INBOUND_DELIVERY_NOT_FOUND', 'الاستلام غير موجود')
    return this.db.transaction(async (trx) => {
      const row = await trx('inbound_deliveries as d')
        .join('inbound_sources as s', 's.id', 'd.source_id')
        .where('d.id', deliveryId)
        .forUpdate('d')
        .first('d.*', 's.key')
      if (!row) throw new KitError(404, 'E_INBOUND_DELIVERY_NOT_FOUND', 'الاستلام غير موجود')
      const eventId = randomUUID()
      await trx('outbox').insert({
        id: eventId,
        event: inboundEventName(String(row.key), String(row.event)),
        payload: JSON.stringify(
          this.envelope(String(row.key), String(row.delivery_id), String(row.event), row.payload)
        ),
      })
      await trx('inbound_deliveries')
        .where('id', row.id)
        .update({ event_id: eventId, dispatches: Number(row.dispatches) + 1 })
    })
  }

  private envelope(source: string, delivery: string, event: string, body: unknown) {
    return { source, delivery, event, body }
  }

  private validate(input: InboundSourceInput, creating: boolean) {
    const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
    const key = text(input.key)
    if (creating && !KEY.test(key))
      throw new KitError(
        422,
        'E_INBOUND_KEY',
        'المفتاح حروف إنجليزية صغيرة وأرقام وشرطة سفلية ويبدأ بحرف (مثل github)'
      )
    const name = text(input.name)
    if (!name || name.length > 100)
      throw new KitError(422, 'E_INBOUND_NAME', 'الاسم مطلوب ولا يتجاوز 100 حرف')
    const algorithm = input.algorithm === undefined ? 'sha256' : input.algorithm
    if (algorithm !== 'sha256' && algorithm !== 'sha512')
      throw new KitError(422, 'E_INBOUND_ALGORITHM', 'الخوارزمية sha256 أو sha512')
    const headerValue = (value: unknown, fallback: string) => {
      const header = value === undefined || value === '' ? fallback : text(value).toLowerCase()
      if (!HEADER.test(header))
        throw new KitError(422, 'E_INBOUND_HEADER', `اسم ترويسة غير صالح: ${String(value)}`)
      return header
    }
    const prefix =
      input.signaturePrefix === undefined ? `${algorithm}=` : text(input.signaturePrefix)
    if (prefix.length > 20 || /[^\x21-\x7e]/.test(prefix))
      throw new KitError(422, 'E_INBOUND_HEADER', 'بادئة التوقيع غير صالحة')
    return {
      key,
      name,
      algorithm,
      signature_header: headerValue(
        input.signatureHeader,
        `x-hub-signature-${algorithm === 'sha256' ? '256' : '512'}`
      ),
      signature_prefix: prefix,
      event_header: headerValue(input.eventHeader, 'x-github-event'),
      delivery_header: headerValue(input.deliveryHeader, 'x-github-delivery'),
    }
  }

  private present(row: Record<string, any>): InboundSource {
    return {
      id: Number(row.id),
      key: String(row.key),
      name: String(row.name),
      algorithm: row.algorithm,
      signatureHeader: String(row.signature_header),
      signaturePrefix: String(row.signature_prefix),
      eventHeader: String(row.event_header),
      deliveryHeader: String(row.delivery_header),
      active: Boolean(row.active),
      createdAt: new Date(row.created_at).toISOString(),
      lastReceivedAt: row.last_received_at ? new Date(row.last_received_at).toISOString() : null,
      path: `/webhooks/in/${row.key}`,
    }
  }
}
