import { useState, type FormEvent, type ReactElement } from 'react'
import { Head, router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { Plus, Trash2 } from 'lucide-react'
import type { RoleSummary } from '@adula/kit'
import Workspace from '~/layouts/workspace'
import { AdminHeader } from '~/components/admin-nav'
import { Button } from '~/components/ui/button'
import { useConfirmAction } from '~/components/ui/confirm-action'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'

type Props = { roles: RoleSummary[] }

export default function RolesIndex({ roles }: Props) {
  const { confirm, confirmation } = useConfirmAction()
  const [name, setName] = useState('')
  const [level, setLevel] = useState('0')
  const create = (event: FormEvent) => {
    event.preventDefault()
    router.post(
      '/admin/roles',
      { name, permissionLevel: Number(level) },
      { preserveScroll: true, onSuccess: () => setName('') }
    )
  }
  return (
    <>
      <Head title="الأدوار" />
      <AdminHeader
        title="الأدوار والصلاحيات"
        description="كل دور يملك مصفوفة كيانات × إجراءات تُكتب مباشرة كقواعد."
      />
      <form
        onSubmit={create}
        className="mb-6 grid gap-3 rounded-xl border border-border bg-white p-5 md:grid-cols-[1fr_140px_auto]"
      >
        <div className="space-y-1">
          <Label htmlFor="role-name">اسم الدور</Label>
          <Input
            id="role-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="role-level">مستوى الصلاحية</Label>
          <Input
            id="role-level"
            type="number"
            min={0}
            max={9}
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          />
        </div>
        <Button type="submit" className="self-end">
          <Plus size={16} />
          إنشاء دور
        </Button>
      </form>
      <section className="overflow-hidden rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الدور</TableHead>
              <TableHead>المستوى</TableHead>
              <TableHead>القواعد</TableHead>
              <TableHead>المستخدمون</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell>
                  <Link href={`/admin/roles/${role.id}`} className="font-semibold text-primary">
                    {role.name}
                  </Link>
                </TableCell>
                <TableCell>{role.permissionLevel}</TableCell>
                <TableCell>{role.rules}</TableCell>
                <TableCell>{role.users}</TableCell>
                <TableCell>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`حذف الدور ${role.name}`}
                    disabled={role.users > 0}
                    onClick={() =>
                      confirm({
                        title: 'حذف الدور؟',
                        description: `سيُحذف دور ${role.name} وقواعد صلاحياته. لا يمكن حذف دور مسند إلى مستخدمين.`,
                        destructive: true,
                        action: () => router.delete(`/admin/roles/${role.id}`),
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {roles.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  لا أدوار بعد.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
      {confirmation}
    </>
  )
}
RolesIndex.layout = (page: ReactElement) => <Workspace>{page}</Workspace>
