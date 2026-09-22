import { useState, type FormEvent, type ReactElement } from 'react'
import { Head, router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { ArrowRight, KeyRound, UserCog, UserMinus, UserCheck, X } from 'lucide-react'
import type { OrgUnitNode, RoleSummary, UserSummary } from '@adula/kit'
import Workspace from '~/layouts/workspace'
import { AdminHeader, useDateTimeFormatter } from '~/components/admin-nav'
import { useConfirmAction } from '~/components/ui/confirm-action'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Label } from '~/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'

type Props = { user: UserSummary; roles: RoleSummary[]; orgUnits: OrgUnitNode[] }
const select = 'h-10 w-full rounded-md border border-input bg-white px-3 text-sm'

export default function UserShow({ user, roles, orgUnits }: Props) {
  const formatDateTime = useDateTimeFormatter()
  const { confirm, confirmation } = useConfirmAction()
  const [roleId, setRoleId] = useState(roles[0] ? String(roles[0].id) : '')
  const [roleUnit, setRoleUnit] = useState('')
  const [unitId, setUnitId] = useState('')
  const base = `/admin/users/${user.id}`
  const post = (url: string, data: Record<string, string | number | null> = {}) =>
    router.post(url, data, { preserveScroll: true })
  const assignRole = (event: FormEvent) => {
    event.preventDefault()
    confirm({
      title: 'إسناد الدور؟',
      description: 'ستتغير الصلاحيات المتاحة لهذا المستخدم فورًا.',
      action: () => post(`${base}/roles`, { roleId, orgUnitId: roleUnit || null }),
    })
  }
  const assignUnit = (event: FormEvent) => {
    event.preventDefault()
    if (unitId) post(`${base}/org-units`, { orgUnitId: unitId })
  }
  const available = orgUnits.filter((unit) => !user.orgUnits.some((own) => own.id === unit.id))
  return (
    <>
      <Head title={user.fullName || user.email} />
      <Link
        href="/admin/users"
        className="mb-6 inline-flex items-center gap-2 text-xs text-muted-foreground"
      >
        <ArrowRight size={15} />
        العودة إلى المستخدمين
      </Link>
      <AdminHeader title={user.fullName || user.email} description={user.email}>
        {user.disabledAt ? (
          <Button variant="outline" onClick={() => post(`${base}/enable`)}>
            <UserCheck size={16} />
            تفعيل الحساب
          </Button>
        ) : (
          <Button
            variant="destructive"
            onClick={() =>
              confirm({
                title: 'تعطيل الحساب؟',
                description: 'سيفقد المستخدم الوصول إلى النظام. لا يمكن تعطيل آخر مدير نشط.',
                destructive: true,
                action: () => post(`${base}/disable`),
              })
            }
          >
            <UserMinus size={16} />
            تعطيل الحساب
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() =>
            confirm({
              title: 'إنهاء جميع الجلسات؟',
              description: 'سيُطلب من هذا المستخدم تسجيل الدخول مجددًا.',
              destructive: true,
              action: () => post(`${base}/revoke-sessions`),
            })
          }
        >
          <KeyRound size={16} />
          إنهاء الجلسات
        </Button>
        <Button
          variant="outline"
          disabled={Boolean(user.disabledAt)}
          onClick={() => post(`${base}/impersonate`)}
        >
          <UserCog size={16} />
          انتحال الحساب
        </Button>
      </AdminHeader>
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        {user.disabledAt ? (
          <Badge variant="destructive">معطّل منذ {formatDateTime(user.disabledAt)}</Badge>
        ) : (
          <Badge>نشط</Badge>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>الأدوار</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الدور</TableHead>
                  <TableHead>الوحدة</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {user.roles.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>{assignment.role}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {assignment.orgUnit ?? 'كل الجهة'}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`إزالة الدور ${assignment.role}`}
                        onClick={() =>
                          confirm({
                            title: 'إزالة الدور؟',
                            description: `سيُسحب دور ${assignment.role} من هذا المستخدم. لا يمكن سحب الإدارة من حسابك الحالي أو إزالة آخر مدير نشط.`,
                            destructive: true,
                            action: () =>
                              router.delete(`${base}/roles/${assignment.id}`, {
                                preserveScroll: true,
                              }),
                          })
                        }
                      >
                        <X size={15} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {user.roles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      لا أدوار مسندة.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <form onSubmit={assignRole} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-1">
                <Label htmlFor="assign-role">الدور</Label>
                <select
                  id="assign-role"
                  className={select}
                  value={roleId}
                  onChange={(event) => setRoleId(event.target.value)}
                  required
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="assign-role-unit">مقيّد بوحدة (اختياري)</Label>
                <select
                  id="assign-role-unit"
                  className={select}
                  value={roleUnit}
                  onChange={(event) => setRoleUnit(event.target.value)}
                >
                  <option value="">كل الجهة</option>
                  {orgUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {'· '.repeat(unit.depth - 1)}
                      {unit.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" className="self-end" disabled={!roleId}>
                إسناد الدور
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>الوحدات التنظيمية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <ul className="space-y-2">
              {user.orgUnits.map((unit) => (
                <li
                  key={unit.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span>
                    {unit.name}
                    <span className="ms-2 text-xs text-muted-foreground" dir="ltr">
                      {unit.path}
                    </span>
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`إزالة من ${unit.name}`}
                    onClick={() =>
                      router.delete(`${base}/org-units/${unit.id}`, { preserveScroll: true })
                    }
                  >
                    <X size={15} />
                  </Button>
                </li>
              ))}
              {user.orgUnits.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  لا عضويات؛ الكيانات المقيدة بالنطاق مخفية عن هذا المستخدم.
                </li>
              )}
            </ul>
            <form onSubmit={assignUnit} className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="space-y-1">
                <Label htmlFor="assign-unit">الوحدة</Label>
                <select
                  id="assign-unit"
                  className={select}
                  value={unitId}
                  onChange={(event) => setUnitId(event.target.value)}
                >
                  <option value="">اختر وحدة</option>
                  {available.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {'· '.repeat(unit.depth - 1)}
                      {unit.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" className="self-end" disabled={!unitId}>
                إضافة إلى الوحدة
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      {confirmation}
    </>
  )
}
UserShow.layout = (page: ReactElement) => <Workspace>{page}</Workspace>
