import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { CheckCircle2, GitBranch, XCircle } from 'lucide-react'
import type { WorkflowRun } from '@adula/kit'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { useUiPreferences } from '~/components/ui/ui-preferences'
import { formatDatetime } from '~/components/ui/resource-value'

const json = { headers: { Accept: 'application/json' }, withXSRFToken: true }
export const runStatusLabel: Record<string, string> = {
  pending_definition: 'بانتظار التعريف',
  running: 'قيد التنفيذ',
  waiting: 'بانتظار موافقة',
  completed: 'مكتمل',
  failed: 'فشل',
  cancelled: 'أُلغي',
}
const outcomeLabel: Record<string, string> = {
  approved: 'معتمد',
  rejected: 'مرفوض',
  completed: 'مكتمل',
  no_workflow: 'بلا تدفق',
}
const eventLabel: Record<string, string> = {
  started: 'بدأ التدفق',
  evaluate: 'تقييم شرط',
  approval_requested: 'طُلبت الموافقة',
  approved: 'موافقة',
  rejected: 'رفض',
  done: 'نُفذت الخطوة',
  delay_started: 'بدأ الانتظار',
  retry_scheduled: 'جدولة إعادة المحاولة',
  failed: 'فشل',
  retried: 'إعادة تشغيل',
  migrated: 'ترحيل إلى إصدار أحدث',
  completed: 'اكتمل',
  cancelled: 'أُلغي',
}

/** Approve or reject with an optional comment, in a confirmation dialog. */
export function WorkflowDecision({
  run,
  onDecided,
}: {
  run: WorkflowRun
  onDecided: (run: WorkflowRun) => void
}) {
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (!run.myApproval) return null
  const submit = async () => {
    if (!decision) return
    setBusy(true)
    setError('')
    try {
      const response = await axios.post<{ data: WorkflowRun }>(
        `/workflows/${run.id}/decide`,
        { decision, comment },
        json
      )
      setDecision(null)
      setComment('')
      onDecided(response.data.data)
    } catch (caught) {
      setError(
        axios.isAxiosError(caught) && caught.response?.data?.error?.message
          ? String(caught.response.data.error.message)
          : 'تعذر تسجيل القرار.'
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setDecision('approve')}>
          <CheckCircle2 size={15} />
          موافقة
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive"
          onClick={() => setDecision('reject')}
        >
          <XCircle size={15} />
          رفض
        </Button>
      </div>
      <Dialog open={decision !== null} onOpenChange={(open) => !open && !busy && setDecision(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{decision === 'approve' ? 'تأكيد الموافقة' : 'تأكيد الرفض'}</DialogTitle>
            <DialogDescription>
              {run.myApproval.title} — {run.resourceLabel} #{run.recordId}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`decision-comment-${run.id}`}>ملاحظة (اختيارية)</Label>
            <Textarea
              id={`decision-comment-${run.id}`}
              value={comment}
              maxLength={1000}
              onChange={(event) => setComment(event.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setDecision(null)}
            >
              تراجع
            </Button>
            <Button
              type="button"
              variant={decision === 'reject' ? 'destructive' : 'default'}
              disabled={busy}
              onClick={() => void submit()}
            >
              {decision === 'approve' ? 'موافقة' : 'رفض'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Workflow runs of one submittable record with their step history. */
export function RecordWorkflows({ resource, id }: { resource: string; id: number | string }) {
  const { calendar } = useUiPreferences()
  const [runs, setRuns] = useState<WorkflowRun[] | null>(null)
  const load = useCallback(async () => {
    try {
      const response = await axios.get<{ data: WorkflowRun[] }>(
        `/resources/${resource}/${id}/workflows`,
        json
      )
      setRuns(response.data.data)
    } catch {
      setRuns([])
    }
  }, [resource, id])
  useEffect(() => {
    void load()
  }, [load])
  if (runs !== null && runs.length === 0) return null
  return (
    <section aria-label="سير العمل" className="rounded-xl border bg-white">
      <div className="flex items-center gap-2 border-b px-7 py-4">
        <GitBranch size={16} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold">سير العمل</h2>
      </div>
      {runs === null ? (
        <p role="status" className="px-7 py-5 text-xs text-muted-foreground">
          جارٍ تحميل سير العمل…
        </p>
      ) : (
        <ul className="divide-y">
          {runs.map((run) => (
            <li key={run.id} className="space-y-3 px-7 py-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{run.label}</span>
                <Badge variant={run.status === 'failed' ? 'destructive' : 'secondary'}>
                  {runStatusLabel[run.status] ?? run.status}
                </Badge>
                {run.outcome && <Badge>{outcomeLabel[run.outcome] ?? run.outcome}</Badge>}
                {run.status === 'waiting' && run.stepLabel && (
                  <span className="text-xs text-muted-foreground">الخطوة: {run.stepLabel}</span>
                )}
                <span className="ms-auto">
                  <WorkflowDecision
                    run={run}
                    onDecided={() => {
                      void load()
                    }}
                  />
                </span>
              </div>
              {run.lastError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                  {run.lastError}
                </p>
              )}
              <ol className="space-y-1 border-s ps-4 text-xs">
                {run.history.map((entry, index) => (
                  <li key={index} className="flex flex-wrap gap-x-3">
                    <span className="font-medium">{eventLabel[entry.event] ?? entry.event}</span>
                    {entry.actorName && <span>{entry.actorName}</span>}
                    {typeof entry.detail.comment === 'string' && (
                      <span className="text-muted-foreground">«{entry.detail.comment}»</span>
                    )}
                    <time dateTime={entry.at} className="text-muted-foreground tabular-nums">
                      {formatDatetime(entry.at, calendar)}
                    </time>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
