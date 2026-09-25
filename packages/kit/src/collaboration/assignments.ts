import type { Knex } from 'knex'
import type { Actor } from '../auth/ability.js'
import type { ResourceService } from '../admin/resource_service.js'
import type { ActorLoader } from './record_collaboration.js'
import { KitError } from '../admin/errors.js'
import { notifyWithTemplate } from '../core/message_templates.js'

export type AssignmentStatus = 'open' | 'done' | 'cancelled'
export type Assignment = {
  id: number
  resource: string
  resourceLabel: string
  recordId: number
  assigneeId: number
  assigneeName: string | null
  assignedBy: number | null
  assignedByName: string | null
  kind: string
  title: string
  note: string | null
  dueOn: string | null
  status: AssignmentStatus
  outcome: string | null
  createdAt: string
  completedAt: string | null
  /** Set for approval steps; completion goes through the workflow engine instead. */
  workflowRunId: string | null
  canComplete: boolean
  canCancel: boolean
}
export type AssignmentPage = { data: Assignment[]; nextCursor: string | null; open: number }

const TITLE_LIMIT = 200
const NOTE_LIMIT = 2000
const DATE = /^\d{4}-\d{2}-\d{2}$/

function dateOnly(value: unknown) {
  if (value === null || value === undefined) return null
  if (value instanceof Date)
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  return String(value)
}

/**
 * Assignments put a record on someone's "my tasks" list. Assigning needs update
 * permission on the record, the assignee must be able to read it, and every read
 * re-checks the record so lost access hides the task instead of leaking it.
 */
export class Assignments {
  constructor(
    private db: Knex,
    private resources: ResourceService,
    private actors: ActorLoader
  ) {}

  async forRecord(name: string, id: number, actor: Actor): Promise<Assignment[]> {
    await this.resources.access(name, id, actor)
    const rows = await this.query()
      .where({ 'a.resource': name, 'a.record_id': id })
      .orderByRaw("(a.status = 'open') DESC, a.id DESC")
      .limit(100)
    return rows.map((row) => this.present(row, actor))
  }

  async assign(
    name: string,
    id: number,
    actor: Actor,
    input: { assigneeId: unknown; title: unknown; note?: unknown; dueOn?: unknown }
  ): Promise<Assignment> {
    await this.resources.access(name, id, actor, 'update')
    const assigneeId = Number(input.assigneeId)
    if (!Number.isSafeInteger(assigneeId) || assigneeId <= 0)
      throw new KitError(422, 'E_ASSIGNEE', 'اختر المستخدم المكلف')
    const title = typeof input.title === 'string' ? input.title.trim() : ''
    if (!title || title.length > TITLE_LIMIT)
      throw new KitError(422, 'E_ASSIGNMENT_TITLE', 'عنوان المهمة مطلوب ولا يتجاوز 200 حرف')
    const note =
      input.note === undefined || input.note === null || input.note === ''
        ? null
        : typeof input.note === 'string' && input.note.length <= NOTE_LIMIT
          ? input.note.trim()
          : null
    if (input.note && note === null)
      throw new KitError(422, 'E_ASSIGNMENT_NOTE', 'الملاحظة لا تتجاوز 2000 حرف')
    const dueOn =
      input.dueOn === undefined || input.dueOn === null || input.dueOn === ''
        ? null
        : typeof input.dueOn === 'string' &&
            DATE.test(input.dueOn) &&
            !Number.isNaN(Date.parse(input.dueOn))
          ? input.dueOn
          : undefined
    if (dueOn === undefined) throw new KitError(422, 'E_ASSIGNMENT_DUE', 'تاريخ الاستحقاق غير صالح')
    if (!(await this.canView(name, id, assigneeId)))
      throw new KitError(422, 'E_ASSIGNEE', 'لا يمكن تكليف مستخدم لا يملك صلاحية عرض السجل')
    return this.create(this.db, {
      resource: name,
      recordId: id,
      assigneeId,
      assignedBy: actor.id,
      title,
      note,
      dueOn,
    }).then((created) => this.present(created, actor))
  }

  /**
   * Inserts an assignment and its notification. Used by assign() and by workflow
   * approval steps inside their own transaction; callers authorize beforehand.
   */
  async create(
    db: Knex,
    input: {
      resource: string
      recordId: number
      assigneeId: number
      assignedBy: number | null
      title: string
      note?: string | null
      dueOn?: string | null
      kind?: string
      workflowRunId?: string
      workflowStep?: string
    }
  ) {
    const insert = async (trx: Knex) => {
      const [row] = await trx('assignments')
        .insert({
          resource: input.resource,
          record_id: input.recordId,
          assignee_id: input.assigneeId,
          assigned_by: input.assignedBy,
          kind: input.kind ?? 'task',
          title: input.title,
          note: input.note ?? null,
          due_on: input.dueOn ?? null,
          workflow_run_id: input.workflowRunId ?? null,
          workflow_step: input.workflowStep ?? null,
        })
        .returning('id')
      await notifyWithTemplate(
        trx,
        input.assigneeId,
        input.kind === 'approval' ? 'assignment.approval' : 'assignment.created',
        {
          title: input.title,
          resource: this.label(input.resource),
          id: input.recordId,
          due: input.dueOn ?? '',
        }
      )
      return this.query(trx).where('a.id', row.id).first()
    }
    return 'isTransaction' in db && db.isTransaction ? insert(db) : this.db.transaction(insert)
  }

  /** The signed-in user's own tasks, open first; records they can no longer read are hidden. */
  async mine(
    actor: Actor,
    options: { status?: string; cursor?: string; limit?: number } = {}
  ): Promise<AssignmentPage> {
    const status = options.status === 'done' || options.status === 'all' ? options.status : 'open'
    const limit = Math.max(1, Math.min(100, Math.floor(Number(options.limit) || 50)))
    const query = this.query().where('a.assignee_id', actor.id).orderBy('a.id', 'desc')
    if (status === 'open') query.where('a.status', 'open')
    if (status === 'done') query.whereNot('a.status', 'open')
    let last: number | null = null
    if (options.cursor !== undefined && options.cursor !== '') {
      last = Number(options.cursor)
      if (!Number.isSafeInteger(last) || last <= 0)
        throw new KitError(422, 'E_CURSOR', 'مؤشر الصفحة غير صالح')
    }
    const data: Assignment[] = []
    let more = true
    // Access is re-checked per record; scan bounded batches to fill the page.
    for (let round = 0; round < 10 && more && data.length < limit; round++) {
      const rows = await query
        .clone()
        .modify((q) => {
          if (last !== null) q.where('a.id', '<', last)
        })
        .limit(100)
      more = rows.length === 100
      for (const row of rows) {
        if (data.length >= limit) {
          more = true
          break
        }
        last = Number(row.id)
        if (await this.resources.permits(row.resource, Number(row.record_id), actor))
          data.push(this.present(row, actor))
      }
    }
    const [{ count }] = await this.db('assignments')
      .where({ assignee_id: actor.id, status: 'open' })
      .count<{ count: string }[]>('* as count')
    return {
      data,
      nextCursor: more && last !== null ? String(last) : null,
      open: Number(count),
    }
  }

  /** The assignee marks the task done, or the assigner cancels it. */
  async complete(assignmentId: unknown, actor: Actor, outcome: 'done' | 'cancelled' = 'done') {
    const id = Number(assignmentId)
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new KitError(404, 'E_ASSIGNMENT_NOT_FOUND', 'المهمة غير موجودة')
    return this.db.transaction(async (trx) => {
      const row = await trx('assignments').where('id', id).forUpdate().first()
      if (!row) throw new KitError(404, 'E_ASSIGNMENT_NOT_FOUND', 'المهمة غير موجودة')
      const involved = row.assignee_id === actor.id || row.assigned_by === actor.id
      if (!involved || !(await this.resources.permits(row.resource, Number(row.record_id), actor)))
        throw new KitError(404, 'E_ASSIGNMENT_NOT_FOUND', 'المهمة غير موجودة')
      if (row.workflow_run_id)
        throw new KitError(409, 'E_ASSIGNMENT_WORKFLOW', 'تُحسم خطوات الموافقة من صندوق الموافقات')
      if (outcome === 'done' && row.assignee_id !== actor.id)
        throw new KitError(403, 'E_FORBIDDEN', 'يُنجز المهمة المكلف بها فقط')
      if (outcome === 'cancelled' && row.assigned_by !== actor.id)
        throw new KitError(403, 'E_FORBIDDEN', 'يلغي المهمة من أسندها فقط')
      if (row.status !== 'open')
        throw new KitError(409, 'E_ASSIGNMENT_CLOSED', 'المهمة مغلقة بالفعل')
      await trx('assignments')
        .where('id', id)
        .update({ status: outcome, completed_at: trx.fn.now(), completed_by: actor.id })
      const notify = outcome === 'done' ? row.assigned_by : row.assignee_id
      if (notify && notify !== actor.id)
        await notifyWithTemplate(
          trx,
          notify,
          outcome === 'done' ? 'assignment.done' : 'assignment.cancelled',
          { title: row.title, resource: this.label(row.resource), id: row.record_id }
        )
    })
  }

  private query(db: Knex = this.db) {
    return db('assignments as a')
      .leftJoin('users as u', 'u.id', 'a.assignee_id')
      .leftJoin('users as b', 'b.id', 'a.assigned_by')
      .select('a.*', 'u.full_name as assignee_name', 'b.full_name as assigned_by_name')
  }

  private present(row: Record<string, any>, actor: Actor): Assignment {
    const open = row.status === 'open'
    return {
      id: Number(row.id),
      resource: String(row.resource),
      resourceLabel: this.label(row.resource),
      recordId: Number(row.record_id),
      assigneeId: Number(row.assignee_id),
      assigneeName: row.assignee_name ? String(row.assignee_name) : null,
      assignedBy: row.assigned_by === null ? null : Number(row.assigned_by),
      assignedByName: row.assigned_by_name ? String(row.assigned_by_name) : null,
      kind: String(row.kind),
      title: String(row.title),
      note: row.note === null ? null : String(row.note),
      dueOn: dateOnly(row.due_on),
      status: row.status as AssignmentStatus,
      outcome: row.outcome === null || row.outcome === undefined ? null : String(row.outcome),
      createdAt: new Date(row.created_at).toISOString(),
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
      workflowRunId: row.workflow_run_id ? String(row.workflow_run_id) : null,
      canComplete: open && !row.workflow_run_id && Number(row.assignee_id) === actor.id,
      canCancel: open && !row.workflow_run_id && Number(row.assigned_by) === actor.id,
    }
  }

  private label(name: string) {
    try {
      return this.resources.label(name)
    } catch {
      return name
    }
  }

  private async canView(name: string, id: number, userId: number) {
    const user = await this.db('users').where('id', userId).first('disabled_at')
    if (!user || user.disabled_at) return false
    return this.resources.permits(name, id, await this.actors.load(userId))
  }
}
