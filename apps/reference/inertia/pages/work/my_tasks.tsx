import { useEffect, useState, type ReactElement } from 'react'
import { Head, router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import axios from 'axios'
import { CalendarClock, CheckCircle2, ListChecks, XCircle } from 'lucide-react'
import type { Assignment, AssignmentPage } from '@adula/kit'
import Workspace from '~/layouts/workspace'
import { useDateTimeFormatter } from '~/components/admin-nav'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'

type Props = { assignments: AssignmentPage; status: 'open' | 'done' | 'all' }

const statusLabel: Record<Assignment['status'], string> = {
  open: 'مفتوحة',
  done: 'منجزة',
  cancelled: 'ملغاة',
}

export default function MyTasks({ assignments, status }: Props) {
  const formatDateTime = useDateTimeFormatter()
  const [rows, setRows] = useState(assignments.data)
  const [cursor, setCursor] = useState(assignments.nextCursor)
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setRows(assignments.data)
    setCursor(assignments.nextCursor)
  }, [assignments])
  const today = new Date().toISOString().slice(0, 10)
  const more = async () => {
    if (!cursor) return
    const response = await axios.get<AssignmentPage>('/my-tasks', {
      params: { cursor, status },
      headers: { Accept: 'application/json' },
    })
    setRows((current) => [...current, ...response.data.data])
    setCursor(response.data.nextCursor)
  }
  const act = async (assignment: Assignment, action: 'complete' | 'cancel') => {
    setBusy(assignment.id)
    setError('')
    try {
      await axios.post(
        `/my-tasks/${assignment.id}/${action}`,
        {},
        { headers: { Accept: 'application/json' }, withXSRFToken: true }
      )
      router.reload({ only: ['assignments'] })
    } catch (caught) {
      setError(
        axios.isAxiosError(caught) && caught.response?.data?.error?.message
          ? String(caught.response.data.error.message)
          : 'تعذر تحديث المهمة.'
      )
    } finally {
      setBusy(null)
    }
  }
  return (
    <>
      <Head title="مهامي" />
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">مهامي</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {assignments.open ? `${assignments.open} مهمة مفتوحة` : 'لا مهام مفتوحة'}
          </p>
        </div>
        <Tabs value={status} onValueChange={(value) => router.get('/my-tasks', { status: value })}>
          <TabsList>
            <TabsTrigger value="open">المفتوحة</TabsTrigger>
            <TabsTrigger value="done">المغلقة</TabsTrigger>
            <TabsTrigger value="all">الكل</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <ul className="space-y-3">
        {rows.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-white px-5 py-4"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {item.title}
                <Badge variant={item.status === 'open' ? 'default' : 'secondary'}>
                  {statusLabel[item.status]}
                </Badge>
                {item.kind === 'approval' && <Badge variant="outline">موافقة</Badge>}
              </p>
              <Link
                href={`/resources/${item.resource}/${item.recordId}`}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                {item.resourceLabel} #{item.recordId}
              </Link>
              {item.note && <p className="text-sm text-muted-foreground">{item.note}</p>}
              <p className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>أسندها: {item.assignedByName ?? 'النظام'}</span>
                <span>{formatDateTime(item.createdAt)}</span>
                {item.dueOn && (
                  <span
                    className={
                      item.status === 'open' && item.dueOn < today
                        ? 'flex items-center gap-1 font-medium text-red-700'
                        : 'flex items-center gap-1'
                    }
                  >
                    <CalendarClock size={13} />
                    الاستحقاق {item.dueOn}
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              {item.canComplete && (
                <Button size="sm" disabled={busy === item.id} onClick={() => act(item, 'complete')}>
                  <CheckCircle2 size={15} />
                  تم الإنجاز
                </Button>
              )}
              {item.canCancel && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === item.id}
                  onClick={() => act(item, 'cancel')}
                >
                  <XCircle size={15} />
                  إلغاء المهمة
                </Button>
              )}
              {item.workflowRunId && item.status === 'open' && (
                <Button size="sm" variant="outline" asChild>
                  <Link href="/approvals">صندوق الموافقات</Link>
                </Button>
              )}
            </div>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-12 text-muted-foreground">
            <ListChecks size={26} />
            لا مهام في هذا العرض.
          </li>
        )}
      </ul>
      {cursor && (
        <div className="mt-6 text-center">
          <Button variant="outline" onClick={more}>
            تحميل المزيد
          </Button>
        </div>
      )}
    </>
  )
}
MyTasks.layout = (page: ReactElement) => <Workspace>{page}</Workspace>
