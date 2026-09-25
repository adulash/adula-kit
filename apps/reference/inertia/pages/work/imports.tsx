import { useEffect, type ReactElement } from 'react'
import { Head, router } from '@inertiajs/react'
import { FileSpreadsheet } from 'lucide-react'
import type { ImportBatch } from '@adula/kit'
import Workspace from '~/layouts/workspace'
import { useDateTimeFormatter } from '~/components/admin-nav'
import { Badge } from '~/components/ui/badge'

type Props = { batches: ImportBatch[] }
const statusLabel: Record<ImportBatch['status'], string> = {
  mapping: 'بانتظار المطابقة',
  queued: 'في الطابور',
  running: 'قيد التنفيذ',
  done: 'اكتمل',
  failed: 'فشل',
}

export default function Imports({ batches }: Props) {
  const formatDateTime = useDateTimeFormatter()
  const active = batches.some((batch) => ['queued', 'running'].includes(batch.status))
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => router.reload({ only: ['batches'] }), 2000)
    return () => clearInterval(timer)
  }, [active])
  return (
    <>
      <Head title="الاستيراد" />
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">الاستيراد</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          دفعات الاستيراد التي رفعتها، وتقدّمها وأخطاء صفوفها.
        </p>
      </div>
      <ul className="space-y-3">
        {batches.map((batch) => (
          <li key={batch.id} className="space-y-2 rounded-xl border bg-white px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <FileSpreadsheet size={16} className="text-muted-foreground" />
              <span className="font-semibold">{batch.fileName}</span>
              <span className="text-sm text-muted-foreground">← {batch.resourceLabel}</span>
              <Badge variant={batch.status === 'done' ? 'default' : 'secondary'}>
                {statusLabel[batch.status]}
              </Badge>
              <span className="ms-auto text-xs text-muted-foreground">
                {formatDateTime(batch.createdAt)}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={`تقدم ${batch.fileName}`}
              aria-valuemin={0}
              aria-valuemax={batch.total}
              aria-valuenow={batch.processed}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${batch.total ? (batch.processed / batch.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-sm">
              {batch.processed} من {batch.total} · نجح {batch.created} · فشل {batch.failed}
            </p>
            {batch.errors.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-red-800">
                  أخطاء الصفوف ({batch.errors.length})
                </summary>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
                  {batch.errors.map((error) => (
                    <li key={error.row}>
                      الصف {error.row}: {error.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
        {batches.length === 0 && (
          <li className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
            لا دفعات استيراد بعد.
          </li>
        )}
      </ul>
    </>
  )
}
Imports.layout = (page: ReactElement) => <Workspace>{page}</Workspace>
