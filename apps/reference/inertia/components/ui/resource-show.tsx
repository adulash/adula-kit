import { Deferred, router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { History, Pencil } from 'lucide-react'
import type {
  ResourceActivity,
  ResourceChildren as Children,
  ResourceDescription,
  ResourceShow as Show,
  SerializedRecord,
} from '@adula/kit'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { useUiPreferences } from '~/components/ui/ui-preferences'
import { Can } from '~/components/ui/can'
import { Skeleton } from '~/components/ui/skeleton'
import { ResourceActions } from '~/components/ui/resource-actions'
import { ResourceValue, formatDatetime, type LookupOptions } from '~/components/ui/resource-value'
import { RecordCollaboration } from '~/components/ui/record-collaboration'

export type ResourceChildren = Children
const meta = new Set(['id', 'version', 'docStatus', 'orgUnitId'])
const activityLabels: Record<string, string> = {
  create: 'إنشاء السجل',
  update: 'تعديل السجل',
  delete: 'حذف السجل',
  submit: 'اعتماد المستند',
  cancel: 'إلغاء الاعتماد',
  amend: 'تعديل بعد الاعتماد',
}

export function documentStatus(status: unknown) {
  return status === 1 ? 'معتمد' : status === 2 ? 'ملغي' : 'مسودة'
}

export function ResourceShow({
  resource,
  result,
  lookups = {},
  childResources = {},
  childrenData,
  activity,
}: {
  resource: ResourceDescription
  result: Show
  lookups?: LookupOptions
  childResources?: Record<string, ResourceDescription>
  childrenData?: ResourceChildren
  activity?: ResourceActivity
}) {
  const { calendar } = useUiPreferences()
  const base = `/resources/${resource.name}/${result.data.id}`
  const fields = resource.fields.filter(
    (field) =>
      resource.show.includes(field.key) && field.type !== 'hasMany' && field.key in result.data
  )
  const children = resource.fields.filter(
    (field) => field.type === 'hasMany' && resource.show.includes(field.key)
  )
  const fieldLabel = (key: string) =>
    resource.fields.find((field) => field.key === key)?.label.ar ?? key
  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Can permissions={result.permissions} action="update">
          <Button asChild>
            <Link href={`${base}/edit`}>
              <Pencil size={15} />
              تعديل السجل
            </Link>
          </Button>
        </Can>
        <ResourceActions
          resource={resource.name}
          id={result.data.id as number}
          version={result.data.version ?? undefined}
          permissions={result.permissions}
          onDone={(action) =>
            action === 'delete' ? router.visit(`/resources/${resource.name}`) : router.reload()
          }
        />
        {resource.submittable && (
          <Badge
            variant={result.data.docStatus === 1 ? 'default' : 'secondary'}
            className={result.data.docStatus === 2 ? 'bg-red-50 text-red-800' : ''}
          >
            {documentStatus(result.data.docStatus)}
          </Badge>
        )}
      </div>
      <dl className="grid gap-7 rounded-xl border bg-white p-7 md:grid-cols-2">
        {fields.map((field) => (
          <div
            key={field.key}
            className={['text', 'json'].includes(field.type) ? 'md:col-span-2' : ''}
          >
            <dt className="mb-2 text-xs text-muted-foreground">{field.label.ar}</dt>
            <dd className="break-words text-sm whitespace-pre-wrap">
              <ResourceValue
                field={field}
                row={result.data}
                related={result.related}
                lookups={lookups}
              />
            </dd>
          </div>
        ))}
        {resource.scoped && result.data.orgUnitId !== undefined && (
          <div>
            <dt className="mb-2 text-xs text-muted-foreground">الوحدة التنظيمية</dt>
            <dd className="text-sm">#{String(result.data.orgUnitId)}</dd>
          </div>
        )}
      </dl>
      {children.length > 0 && (
        <Deferred data="childrenData" fallback={<SectionSkeleton title="البنود" rows={3} />}>
          <div className="space-y-5">
            {children.map((field) => {
              const group = childrenData?.[field.key]
              if (!group) return null
              const child = childResources[field.key]
              const columns = child
                ? child.fields.filter(
                    (entry) => child.list.includes(entry.key) && entry.type !== 'hasMany'
                  )
                : []
              const keys = columns.length
                ? columns.map((entry) => entry.key)
                : [...new Set(group.rows.flatMap((row) => Object.keys(row)))].filter(
                    (key) => !meta.has(key)
                  )
              return (
                <section
                  key={field.key}
                  aria-label={field.label.ar}
                  className="rounded-xl border bg-white"
                >
                  <div className="flex items-center justify-between border-b px-7 py-4">
                    <h2 className="text-sm font-semibold">{field.label.ar}</h2>
                    <span className="text-xs text-muted-foreground">
                      {group.rows.length} بند{group.hasMore ? ' · تظهر أول 100 بند متاح' : ''}
                    </span>
                  </div>
                  {group.rows.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[480px] text-sm">
                        <thead className="bg-muted text-xs text-muted-foreground">
                          <tr>
                            {keys.map((key) => (
                              <th
                                key={key}
                                scope="col"
                                className="px-5 py-3 text-start font-medium"
                              >
                                {columns.find((entry) => entry.key === key)?.label.ar ?? key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((row) => (
                            <tr key={String(row.id)} className="border-b last:border-0">
                              {keys.map((key) => {
                                const column = columns.find((entry) => entry.key === key)
                                return (
                                  <td key={key} className="px-5 py-3">
                                    {column ? (
                                      <ResourceValue field={column} row={row} lookups={lookups} />
                                    ) : (
                                      plain(row, key)
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="px-7 py-6 text-xs text-muted-foreground">لا توجد بنود متاحة.</p>
                  )}
                </section>
              )
            })}
          </div>
        </Deferred>
      )}
      <RecordCollaboration resource={resource} id={result.data.id as number} />
      <Deferred data="activity" fallback={<SectionSkeleton title="سجل النشاط" rows={4} />}>
        <section aria-label="سجل النشاط" className="rounded-xl border bg-white">
          <div className="flex items-center gap-2 border-b px-7 py-4">
            <History size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold">سجل النشاط</h2>
            <span className="ms-auto text-xs text-muted-foreground">
              آخر {activity?.length ?? 0} إجراء
            </span>
          </div>
          {activity?.length ? (
            <ol className="divide-y">
              {activity.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-7 py-3 text-sm"
                >
                  <span className="font-medium">
                    {activityLabels[entry.action] ?? entry.action}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {entry.actorName ?? `مستخدم #${entry.actorId}`}
                  </span>
                  <time
                    dateTime={entry.createdAt}
                    className="text-xs text-muted-foreground tabular-nums"
                  >
                    {formatDatetime(entry.createdAt, calendar)}
                  </time>
                  {entry.fields.length > 0 && (
                    <span className="basis-full text-xs text-muted-foreground">
                      الحقول: {entry.fields.map(fieldLabel).join('، ')}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-7 py-6 text-xs text-muted-foreground">لا يوجد نشاط مسجل بعد.</p>
          )}
        </section>
      </Deferred>
    </div>
  )
}

function plain(row: SerializedRecord, key: string) {
  const value = row[key]
  if (value === null || value === undefined) return '—'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function SectionSkeleton({ title, rows }: { title: string; rows: number }) {
  return (
    <section
      role="status"
      aria-label={`جارٍ تحميل ${title}`}
      className="rounded-xl border bg-white"
    >
      <div className="border-b px-7 py-4">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="space-y-3 px-7 py-5">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-4 w-full" />
        ))}
      </div>
    </section>
  )
}
