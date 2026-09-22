import type { Knex } from 'knex'
import type { ResourceRegistry } from '../resource/registry.js'
import type { Action, Label, Resource } from '../resource/types.js'
import type { Conditions } from '../auth/conditions.js'
import { conditionSql } from '../auth/sql.js'
import { KitError } from '../admin/errors.js'
import { logActivity } from './activity.js'
import { administrationGuard } from './administration_guard.js'

export type RoleSummary = {
  id: number
  name: string
  permissionLevel: number
  rules: number
  users: number
}
export type RoleRule = {
  id: number
  subject: string
  action: string
  inverted: boolean
  conditions: Conditions | null
  fields: string[] | null
}
export type RoleDetail = Omit<RoleSummary, 'rules'> & { rules: RoleRule[] }
export type RuleInput = {
  subject: string
  action: string
  inverted?: boolean
  conditions?: Conditions | null
  fields?: string[] | null
}
export type MatrixField = { key: string; label: Label; type: string; conditionable: boolean }
export type MatrixSubject = {
  name: string
  label: Label
  actions: string[]
  fields: MatrixField[]
  /** Standard columns the resource actually has plus its conditionable fields. */
  conditionFields: MatrixField[]
}
export type RoleMatrix = { actions: string[]; subjects: MatrixSubject[] }

const RESOURCE = 'core.roles'
const ACTION_ORDER: Action[] = ['view', 'create', 'update', 'delete', 'submit', 'cancel', 'amend']
export const ALL_SUBJECT_LABEL: Label = { ar: 'كل الكيانات', en: 'All resources' }

function standardConditionFields(resource: Resource): MatrixField[] {
  const field = (key: string, ar: string, en: string): MatrixField => ({
    key,
    label: { ar, en },
    type: 'integer',
    conditionable: true,
  })
  return [
    field('id', 'المعرّف', 'ID'),
    field('createdBy', 'أنشأه', 'Created by'),
    field('updatedBy', 'عدّله', 'Updated by'),
    ...(resource.scoped ? [field('orgUnitId', 'الوحدة التنظيمية', 'Organization unit')] : []),
    ...(resource.submittable ? [field('docStatus', 'حالة المستند', 'Document status')] : []),
    ...(resource.version ? [field('version', 'الإصدار', 'Version')] : []),
  ]
}
function matrixFields(resource: Resource): MatrixField[] {
  return Object.entries(resource.fields).map(([key, field]) => ({
    key,
    label: field.label,
    type: field.type,
    conditionable: !['hasMany', 'json', 'attachment'].includes(field.type),
  }))
}

function roleName(value: unknown) {
  const name = typeof value === 'string' ? value.trim() : ''
  if (!name || name.length > 100)
    throw new KitError(422, 'E_ROLE_NAME', 'اسم الدور مطلوب (حتى 100 حرف)')
  return name
}
function permissionLevel(value: unknown) {
  const level = Number(value ?? 0)
  if (!Number.isSafeInteger(level) || level < 0 || level > 9)
    throw new KitError(422, 'E_ROLE_LEVEL', 'مستوى الصلاحية رقم بين 0 و9')
  return level
}
function toRule(row: Record<string, unknown>): RoleRule {
  return {
    id: Number(row.id),
    subject: String(row.subject),
    action: String(row.action),
    inverted: Boolean(row.inverted),
    conditions: (row.conditions as Conditions | null) ?? null,
    fields: (row.fields as string[] | null) ?? null,
  }
}

export class RolesAdmin {
  constructor(
    private db: Knex,
    private registry: ResourceRegistry
  ) {}

  async list(): Promise<RoleSummary[]> {
    const rows = await this.db('roles as r')
      .select(
        'r.id',
        'r.name',
        'r.permission_level',
        this.db.raw('(SELECT count(*) FROM role_rules rr WHERE rr.role_id = r.id) AS rules'),
        this.db.raw(
          '(SELECT count(DISTINCT ur.user_id) FROM user_roles ur WHERE ur.role_id = r.id) AS users'
        )
      )
      .orderBy('r.name')
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      permissionLevel: row.permission_level,
      rules: Number(row.rules),
      users: Number(row.users),
    }))
  }

  async get(id: number): Promise<RoleDetail> {
    const role = await this.find(this.db, id)
    const rules = await this.db('role_rules')
      .where('role_id', id)
      .orderBy(['subject', 'action', 'inverted'])
    const users = await this.db('user_roles')
      .where('role_id', id)
      .countDistinct('user_id as count')
      .first()
    return {
      id: role.id,
      name: role.name,
      permissionLevel: role.permission_level,
      users: Number(users?.count ?? 0),
      rules: rules.map(toRule),
    }
  }

  async create(actorId: number, input: { name: string; permissionLevel?: number }) {
    const name = roleName(input.name)
    const level = permissionLevel(input.permissionLevel)
    return this.db.transaction(async (trx) => {
      if (await trx('roles').where('name', name).first())
        throw new KitError(409, 'E_ROLE_EXISTS', 'يوجد دور بهذا الاسم')
      const [role] = await trx('roles').insert({ name, permission_level: level }).returning('*')
      await logActivity(trx, {
        resource: RESOURCE,
        recordId: role.id,
        actorId,
        action: 'create',
        changes: { name, permissionLevel: level },
      })
      return { id: role.id as number, name, permissionLevel: level }
    })
  }

  async rename(actorId: number, id: number, value: string) {
    const name = roleName(value)
    return this.db.transaction(async (trx) => {
      const role = await this.find(trx, id)
      if (role.name === 'administrator' && name !== role.name)
        throw new KitError(
          409,
          'E_BOOTSTRAP_ROLE',
          'اسم دور مدير النظام الأساسي محمي لاستعادة الوصول عند الحاجة'
        )
      if (await trx('roles').where('name', name).whereNot('id', id).first())
        throw new KitError(409, 'E_ROLE_EXISTS', 'يوجد دور بهذا الاسم')
      await trx('roles').where('id', id).update({ name })
      await logActivity(trx, {
        resource: RESOURCE,
        recordId: id,
        actorId,
        action: 'rename',
        changes: { from: role.name, to: name },
      })
    })
  }

  async setPermissionLevel(actorId: number, id: number, value: number) {
    const level = permissionLevel(value)
    return this.db.transaction(async (trx) => {
      const role = await this.find(trx, id)
      await trx('roles').where('id', id).update({ permission_level: level })
      await logActivity(trx, {
        resource: RESOURCE,
        recordId: id,
        actorId,
        action: 'set_level',
        changes: { from: role.permission_level, to: level },
      })
    })
  }

  async delete(actorId: number, id: number) {
    return this.db.transaction(async (trx) => {
      const role = await this.find(trx, id)
      const assigned = await trx('user_roles').where('role_id', id).first()
      if (assigned) throw new KitError(409, 'E_ROLE_IN_USE', 'لا يمكن حذف دور مسند إلى مستخدمين')
      await trx('roles').where('id', id).delete()
      await logActivity(trx, {
        resource: RESOURCE,
        recordId: id,
        actorId,
        action: 'delete',
        changes: { name: role.name },
      })
    })
  }

  /** Subjects × actions derived from the registry; the UI never hard-codes resources. */
  matrix(): RoleMatrix {
    const resources = this.registry.all()
    const union = ACTION_ORDER.filter((action) =>
      resources.some((resource) => resource.actions.includes(action))
    )
    return {
      actions: [...union, 'invite', 'manage'],
      subjects: [
        {
          name: 'all',
          label: ALL_SUBJECT_LABEL,
          actions: [...union, 'invite', 'manage'],
          fields: [],
          conditionFields: [],
        },
        {
          name: 'core.users',
          label: { ar: 'دعوات المستخدمين', en: 'User invitations' },
          actions: ['invite', 'manage'],
          fields: [],
          conditionFields: [],
        },
        ...resources.map((resource) => {
          const fields = matrixFields(resource)
          return {
            name: resource.name,
            label: resource.label,
            actions: [...ACTION_ORDER.filter((a) => resource.actions.includes(a)), 'manage'],
            fields,
            conditionFields: [
              ...standardConditionFields(resource),
              ...fields.filter((field) => field.conditionable),
            ],
          }
        }),
      ],
    }
  }

  async setRule(actorId: number, roleId: number, input: RuleInput): Promise<RoleRule> {
    const rule = this.validateRule(input)
    return this.db.transaction(async (trx) => {
      const verifyAccess = await administrationGuard(trx, actorId)
      await this.find(trx, roleId)
      const values = {
        conditions: rule.conditions ? JSON.stringify(rule.conditions) : null,
        fields: rule.fields ? JSON.stringify(rule.fields) : null,
      }
      const existing = await trx('role_rules')
        .where({
          role_id: roleId,
          subject: rule.subject,
          action: rule.action,
          inverted: rule.inverted,
        })
        .first()
      const [row] = existing
        ? await trx('role_rules').where('id', existing.id).update(values).returning('*')
        : await trx('role_rules')
            .insert({
              role_id: roleId,
              subject: rule.subject,
              action: rule.action,
              inverted: rule.inverted,
              ...values,
            })
            .returning('*')
      const saved = toRule(row)
      await verifyAccess()
      await logActivity(trx, {
        resource: RESOURCE,
        recordId: roleId,
        actorId,
        action: 'set_rule',
        changes: { rule: saved },
      })
      return saved
    })
  }

  async removeRule(actorId: number, roleId: number, ruleId: number) {
    return this.db.transaction(async (trx) => {
      const verifyAccess = await administrationGuard(trx, actorId)
      await this.find(trx, roleId)
      const [row] = await trx('role_rules')
        .where({ id: ruleId, role_id: roleId })
        .delete()
        .returning('*')
      if (!row) throw new KitError(404, 'E_RULE_NOT_FOUND', 'القاعدة غير موجودة')
      await verifyAccess()
      await logActivity(trx, {
        resource: RESOURCE,
        recordId: roleId,
        actorId,
        action: 'remove_rule',
        changes: { rule: toRule(row) },
      })
    })
  }

  private validateRule(input: RuleInput) {
    const subject = typeof input.subject === 'string' ? input.subject : ''
    let resource: Resource | undefined
    if (subject !== 'all' && subject !== 'core.users') {
      try {
        resource = this.registry.get(subject)
      } catch {
        throw new KitError(422, 'E_RULE_SUBJECT', 'الكيان غير معروف')
      }
    }
    const action = typeof input.action === 'string' ? input.action : ''
    const allowed: string[] =
      subject === 'core.users'
        ? ['invite', 'manage']
        : resource
          ? [...resource.actions, 'manage']
          : [...new Set(this.registry.all().flatMap((r) => [...r.actions])), 'invite', 'manage']
    if (!allowed.includes(action as Action))
      throw new KitError(422, 'E_RULE_ACTION', 'الإجراء غير متاح لهذا الكيان')
    const inverted = Boolean(input.inverted)
    let conditions: Conditions | null = null
    if (
      input.conditions !== undefined &&
      input.conditions !== null &&
      !(
        typeof input.conditions === 'object' &&
        !Array.isArray(input.conditions) &&
        !Object.keys(input.conditions).length
      )
    ) {
      if (!resource) throw new KitError(422, 'E_RULE_CONDITIONS', 'الشروط تتطلب اختيار كيان محدد')
      if (typeof input.conditions !== 'object' || Array.isArray(input.conditions))
        throw new KitError(422, 'E_RULE_CONDITIONS', 'الشروط يجب أن تكون كائناً')
      if ('orgPath' in input.conditions)
        throw new KitError(422, 'E_RULE_CONDITIONS', 'orgPath محجوز لنطاق الدور')
      const conditionable = new Set(
        [...standardConditionFields(resource), ...matrixFields(resource)]
          .filter((field) => field.conditionable)
          .map((field) => field.key)
      )
      for (const field of Object.keys(input.conditions))
        if (!conditionable.has(field))
          throw new KitError(422, 'E_RULE_CONDITIONS', `الحقل ${field} لا يقبل الشروط`)
      try {
        conditionSql(input.conditions, resource)
      } catch (error) {
        throw new KitError(422, 'E_RULE_CONDITIONS', `شرط غير مدعوم: ${(error as Error).message}`)
      }
      conditions = input.conditions
    }
    let fields: string[] | null = null
    if (
      input.fields !== undefined &&
      input.fields !== null &&
      !(Array.isArray(input.fields) && !input.fields.length)
    ) {
      if (!resource) throw new KitError(422, 'E_RULE_FIELDS', 'قائمة الحقول تتطلب اختيار كيان محدد')
      if (!Array.isArray(input.fields) || !input.fields.every((f) => typeof f === 'string'))
        throw new KitError(422, 'E_RULE_FIELDS', 'قائمة الحقول غير صالحة')
      for (const field of input.fields)
        if (!(field in resource.fields))
          throw new KitError(422, 'E_RULE_FIELDS', `الحقل ${field} غير معروف`)
      fields = [...new Set(input.fields)]
    }
    return { subject, action, inverted, conditions, fields }
  }

  private async find(db: Knex, id: number) {
    const role = await db('roles').where('id', id).first()
    if (!role) throw new KitError(404, 'E_ROLE_NOT_FOUND', 'الدور غير موجود')
    return role
  }
}
