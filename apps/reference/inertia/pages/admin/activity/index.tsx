import { useState, type FormEvent, type ReactElement } from 'react'
import { Head, router } from '@inertiajs/react'
import axios from 'axios'
import { Filter } from 'lucide-react'
import type { ActivityPage } from '@adula/kit'
import Workspace from '~/layouts/workspace'
import { AdminHeader, useDateTimeFormatter } from '~/components/admin-nav'
import { Button } from '~/components/ui/button'
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

type Filters = { resource: string; action: string; actorId: string; from: string; to: string }
type Props = {
  activity: ActivityPage
  facets: { resources: string[]; actions: string[] }
  filters: Filters
}
const select = 'h-9 w-full rounded-md border border-input bg-white px-2 text-sm'

export default function ActivityIndex({ activity, facets, filters }: Props) {
  const formatDateTime = useDateTimeFormatter()
  const [draft, setDraft] = useState<Filters>(filters)
  const [rows, setRows] = useState(activity.data)
  const [cursor, setCursor] = useState(activity.nextCursor)
  const [loading, setLoading] = useState(false)
  const set = (key: keyof Filters, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }))
  const apply = (event: FormEvent) => {
    event.preventDefault()
    const query = Object.fromEntries(Object.entries(draft).filter(([, value]) => value))
    router.get('/admin/activity', query, { preserveState: false })
  }
  const more = async () => {
    if (!cursor) return
    setLoading(true)
    try {
      const response = await axios.get<ActivityPage>('/admin/activity', {
        params: { ...filters, cursor },
        headers: { Accept: 'application/json' },
      })
      setRows((current) => [...current, ...response.data.data])
      setCursor(response.data.nextCursor)
    } finally {
      setLoading(false)
    }
  }
  return (
    <>
      <Head title="سجل النشاط" />
      <AdminHeader
        title="سجل النشاط"
        description="كل تغيير على السجلات والإدارة يُكتب داخل معاملته."
      />
      <form
        onSubmit={apply}
        className="mb-6 grid gap-3 rounded-xl border border-border bg-white p-5 md:grid-cols-6"
      >
        <div className="space-y-1">
          <Label htmlFor="filter-resource">الكيان</Label>
          <select
            id="filter-resource"
            className={select}
            value={draft.resource}
            onChange={(event) => set('resource', event.target.value)}
          >
            <option value="">الكل</option>
            {facets.resources.map((resource) => (
              <option key={resource} value={resource}>
                {resource}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="filter-action">الإجراء</Label>
          <select
            id="filter-action"
            className={select}
            value={draft.action}
            onChange={(event) => set('action', event.target.value)}
          >
            <option value="">الكل</option>
            {facets.actions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="filter-actor">معرّف المنفّذ</Label>
          <Input
            id="filter-actor"
            type="number"
            min={1}
            value={draft.actorId}
            onChange={(event) => set('actorId', event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="filter-from">من تاريخ</Label>
          <Input
            id="filter-from"
            type="date"
            value={draft.from}
            onChange={(event) => set('from', event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="filter-to">إلى تاريخ</Label>
          <Input
            id="filter-to"
            type="date"
            value={draft.to}
            onChange={(event) => set('to', event.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" className="self-end">
          <Filter size={15} />
          تصفية
        </Button>
      </form>
      <section className="overflow-hidden rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الوقت</TableHead>
              <TableHead>الكيان</TableHead>
              <TableHead>السجل</TableHead>
              <TableHead>الإجراء</TableHead>
              <TableHead>المنفّذ</TableHead>
              <TableHead>التغييرات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap text-xs">
                  {formatDateTime(row.createdAt)}
                </TableCell>
                <TableCell>{row.resource}</TableCell>
                <TableCell>{row.recordId}</TableCell>
                <TableCell>{row.action}</TableCell>
                <TableCell dir="ltr" className="text-xs">
                  {row.actor ?? row.actorId}
                </TableCell>
                <TableCell>
                  <code className="line-clamp-2 max-w-md text-xs" dir="ltr">
                    {JSON.stringify(row.changes)}
                  </code>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  لا نشاط مطابق.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {cursor && (
          <div className="border-t border-border p-4 text-center">
            <Button variant="outline" onClick={more} disabled={loading}>
              {loading ? 'جارٍ التحميل…' : 'تحميل المزيد'}
            </Button>
          </div>
        )}
      </section>
    </>
  )
}
ActivityIndex.layout = (page: ReactElement) => <Workspace>{page}</Workspace>
