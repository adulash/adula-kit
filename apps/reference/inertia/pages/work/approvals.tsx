import { type ReactElement } from 'react'
import { Head, router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { Inbox } from 'lucide-react'
import type { WorkflowRun } from '@adula/kit'
import Workspace from '~/layouts/workspace'
import { useDateTimeFormatter } from '~/components/admin-nav'
import { WorkflowDecision } from '~/components/ui/record-workflows'

type Props = { runs: WorkflowRun[] }

export default function Approvals({ runs }: Props) {
  const formatDateTime = useDateTimeFormatter()
  return (
    <>
      <Head title="صندوق الموافقات" />
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">صندوق الموافقات</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {runs.length ? `${runs.length} مستند بانتظار قرارك` : 'لا مستندات بانتظار قرارك'}
        </p>
      </div>
      <ul className="space-y-3">
        {runs.map((run) => (
          <li
            key={run.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-5 py-4"
          >
            <div className="min-w-0 space-y-1">
              <p className="font-semibold">{run.myApproval?.title ?? run.stepLabel}</p>
              <Link
                href={`/resources/${run.resource}/${run.recordId}`}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                {run.resourceLabel} #{run.recordId}
              </Link>
              <p className="text-xs text-muted-foreground">
                {run.label} · بدأ {formatDateTime(run.createdAt)}
              </p>
            </div>
            <WorkflowDecision run={run} onDecided={() => router.reload({ only: ['runs'] })} />
          </li>
        ))}
        {runs.length === 0 && (
          <li className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-muted-foreground">
            <Inbox size={26} />
            لا موافقات معلقة.
          </li>
        )}
      </ul>
    </>
  )
}
Approvals.layout = (page: ReactElement) => <Workspace>{page}</Workspace>
