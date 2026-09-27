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
import { formatDate } from '~/components/ui/resource-value'
import { useUiPreferences } from '~/components/ui/ui-preferences'
import { WorkflowDecision } from '~/components/ui/record-workflows'

type Tab = 'all' | 'approvals' | 'assigned' | 'closed'
type Props = { assignments: AssignmentPage; tab: Tab }

const statusLabel: Record<Assignment['status'], string> = {
  open: 'مفتوحة',
  done: 'منجزة',
  cancelled: 'ملغاة',
}
const empty: Record<Tab, string> = {
  all: 'لا مهام ولا موافقات مفتوحة.',
  approvals: 'لا موافقات بانتظار قرارك.',
  assigned: 'لا مهام مسندة إليك مفتوحة.',
  closed: 'لا مهام مغلقة بعد.',
}

/** Everything waiting for the user: assigned tasks and approval decisions, acted on in place. */
export default function MyTasks({ assignments, tab }: Props) {
  const formatDateTime = useDateTimeFormatter()
  const { calendar } = useUiPreferences()
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
      params: { cursor, tab },
      headers: { Accept: 'application/json' },
    })
    setRows((current) => [...current, ...response.data.data])
    setCursor(response.data.nextCursor)
  }
  const reload = () => router.reload({ only: ['assignments', 'openTasks'] })
  const act = async (assignment: Assignment, action: 'complete' | 'cancel') => {
    setBusy(assignment.id)
    setError('')
    try {
      await axios.post(
        `/my-tasks/${assignment.id}/${action}`,
        {},
        { headers: { Accept: 'application/json' }, withXSRFToken: true }
      )
      reload()
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
  const tasks = assignments.open - assignments.approvals
  return (
    <>
      <Head title="مهامي" />
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">مهامي</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {assignments.open
              ? `${assignments.open} مفتوحة، منها ${assignments.approvals} بانتظار قرارك`
              : 'لا مهام مفتوحة'}
          </p>
        </div>
        <Tabs value={tab} onValueChange={(value) => router.get('/my-tasks', { tab: value })}>
          <TabsList>
            <TabsTrigger value="all">الكل{assignments.open ? ` (${assignments.open})` : ''}</TabsTrigger>
            <TabsTrigger value="approvals">
              بانتظار قراري{assignments.approvals ? ` (${assignments.approvals})` : ''}
            </TabsTrigger>
            <TabsTrigger value="assigned">مهام مسندة{tasks ? ` (${tasks})` : ''}</TabsTrigger>
            <TabsTrigger value="closed">المغلقة</TabsTrigger>
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
                {item.resourceLabel}: <bdi>{item.recordTitle}</bdi>
              </Link>
              {item.note && <p className="text-sm text-muted-foreground">{item.note}</p>}
              <p className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>
                  {item.kind === 'approval' ? 'طلبها' : 'أسندها'}: {item.assignedByName ?? 'النظام'}
                </span>
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
                    الاستحقاق <bdi className="tabular-nums">{formatDate(item.dueOn, calendar)}</bdi>
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              {item.canDecide && item.workflowRunId && (
                <WorkflowDecision
                  run={{
                    id: item.workflowRunId,
                    resourceLabel: item.resourceLabel,
                    recordTitle: item.recordTitle,
                    myApproval: { assignmentId: item.id, title: item.title },
                  }}
                  onDecided={reload}
                />
              )}
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
            </div>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-12 text-muted-foreground">
            <ListChecks size={26} />
            {empty[tab]}
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
