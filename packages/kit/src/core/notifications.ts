import type { Knex } from 'knex'
import { KitError } from '../admin/errors.js'
import { pageLimit } from './activity.js'
import type { ResourceRegistry } from '../resource/registry.js'

export type Notification = {
  id: number
  title: string
  body: string
  readAt: string | null
  createdAt: string
  /**
   * The record the notification is about, while its resource is still registered.
   * The record page authorizes the reader when the link is opened.
   */
  target: { resource: string; recordId: number; href: string } | null
}
export type NotificationPage = { data: Notification[]; nextCursor: string | null; unread: number }

export class NotificationsAdmin {
  constructor(
    private db: Knex,
    /** Without a registry, stored targets are returned as they are. */
    private registry?: Pick<ResourceRegistry, 'has'>
  ) {}

  private target(row: Record<string, any>): Notification['target'] {
    if (!row.resource || row.record_id === null || row.record_id === undefined) return null
    const resource = String(row.resource)
    if (this.registry && !this.registry.has(resource)) return null
    const recordId = Number(row.record_id)
    return { resource, recordId, href: `/resources/${resource}/${recordId}` }
  }

  /** Unread first, newest first; the cursor remembers which of the two segments it is in. */
  async list(
    userId: number,
    options: { cursor?: string; limit?: number } = {}
  ): Promise<NotificationPage> {
    const limit = pageLimit(options.limit)
    const query = this.db('notifications')
      .where('user_id', userId)
      .orderByRaw('(read_at IS NULL) DESC, id DESC')
      .limit(limit + 1)
    if (options.cursor) {
      const match = /^([ur]):(\d{1,18})$/.exec(options.cursor)
      if (!match) throw new KitError(422, 'E_NOTIFICATION_CURSOR', 'مؤشر الصفحة غير صالح')
      const id = Number(match[2])
      if (match[1] === 'u')
        query.where((where) =>
          where
            .where((unread) => unread.whereNull('read_at').where('id', '<', id))
            .orWhereNotNull('read_at')
        )
      else query.whereNotNull('read_at').where('id', '<', id)
    }
    const rows = await query
    const page = rows.slice(0, limit)
    const last = page[page.length - 1]
    return {
      data: page.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
        createdAt: new Date(row.created_at).toISOString(),
        target: this.target(row),
      })),
      nextCursor: rows.length > limit ? `${last.read_at ? 'r' : 'u'}:${last.id}` : null,
      unread: await this.unreadCount(userId),
    }
  }

  async markRead(userId: number, id: number) {
    const owned = await this.db('notifications').where({ id, user_id: userId }).first('id')
    if (!owned) throw new KitError(404, 'E_NOTIFICATION_NOT_FOUND', 'الإشعار غير موجود')
    await this.db('notifications')
      .where({ id, user_id: userId })
      .whereNull('read_at')
      .update({ read_at: this.db.fn.now() })
  }

  /** Marks the notification read and returns where it points (null without a target). */
  async open(userId: number, id: number) {
    const row = await this.db('notifications').where({ id, user_id: userId }).first()
    if (!row) throw new KitError(404, 'E_NOTIFICATION_NOT_FOUND', 'الإشعار غير موجود')
    if (!row.read_at)
      await this.db('notifications')
        .where({ id, user_id: userId })
        .whereNull('read_at')
        .update({ read_at: this.db.fn.now() })
    return this.target(row)?.href ?? null
  }

  async markAllRead(userId: number) {
    return this.db('notifications')
      .where('user_id', userId)
      .whereNull('read_at')
      .update({ read_at: this.db.fn.now() })
  }

  async unreadCount(userId: number) {
    const row = await this.db('notifications')
      .where('user_id', userId)
      .whereNull('read_at')
      .count('id as count')
      .first()
    return Number(row?.count ?? 0)
  }
}
