import { Head } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { Plus } from 'lucide-react'
import type {
  RecordPermissions,
  ResourceActivity,
  ResourceChildren,
  ResourceDescription,
  ResourceEditor,
  ResourceList,
  ResourceLookups,
  SavedView,
  ResourceShow as Show,
} from '@adula/kit'
import { Button } from '~/components/ui/button'
import { DataTable } from '~/components/ui/data-table'
import { ResourceForm } from '~/components/ui/resource-form'
import { ResourceShow } from '~/components/ui/resource-show'
import { ResourceSurface, type ResourcePresentation } from '~/components/ui/resource-surface'

/** The discriminated view stays nested: Inertia's page typing flattens top-level unions. */
export type ResourceView =
  | {
      mode: 'index'
      resource: ResourceDescription
      lookups: ResourceLookups
      savedViews: SavedView[]
    }
  | { mode: 'form'; editor: ResourceEditor; permissions: RecordPermissions }
  | {
      mode: 'show'
      resource: ResourceDescription
      result: Show
      lookups: ResourceLookups
      childResources: Record<string, ResourceDescription>
    }
export type ResourcePageProps = {
  view: ResourceView
  /** Index pages receive the list as a top-level `inertia.scroll` prop so pages merge into `result.data`. */
  result?: ResourceList
  childrenData?: ResourceChildren
  activity?: ResourceActivity
  /** Set to page only when the user requests a non-modal form/detail override. */
  presentation?: ResourcePresentation
}

export function ResourcePage({
  view,
  result,
  childrenData,
  activity,
  presentation,
}: ResourcePageProps) {
  const name = view.mode === 'form' ? view.editor.name : view.resource.name
  const label = view.mode === 'form' ? view.editor.label : view.resource.label
  const title =
    view.mode === 'index'
      ? label
      : view.mode === 'form'
        ? `${view.editor.mode === 'create' ? 'إضافة' : 'تعديل'} · ${label}`
        : `تفاصيل · ${label}`
  return (
    <>
      <Head title={title} />
      {view.mode === 'index' && (
        <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              سجلاتك ومتابعتك اليومية في مكان واحد.
            </p>
          </div>
          {view.mode === 'index' && view.resource.canCreate && (
            <Button asChild>
              <Link href={`/resources/${name}/create`}>
                <Plus size={16} />
                إضافة سجل
              </Link>
            </Button>
          )}
        </div>
      )}
      {view.mode === 'index' ? (
        result ? (
          <DataTable
            key={name}
            resource={view.resource}
            result={result}
            lookups={view.lookups}
            savedViews={view.savedViews}
          />
        ) : null
      ) : (
        <ResourceSurface
          key={`${name}:${view.mode}:${view.mode === 'form' ? (view.editor.record?.id ?? 'new') : view.result.data.id}`}
          mode={view.mode === 'form' ? 'edit' : 'view'}
          title={title}
          description={
            view.mode === 'form'
              ? 'أكمل الحقول المطلوبة ثم احفظ السجل.'
              : 'راجع التفاصيل المتاحة لك وأكمل عملك.'
          }
          backHref={`/resources/${name}`}
          presentation={presentation}
        >
          {view.mode === 'form' ? (
            <ResourceForm
              key={`${name}:${view.editor.record?.id ?? 'new'}`}
              editor={view.editor}
              permissions={view.permissions}
            />
          ) : (
            <ResourceShow
              key={`${name}:${view.result.data.id}`}
              resource={view.resource}
              result={view.result}
              lookups={view.lookups}
              childResources={view.childResources}
              childrenData={childrenData}
              activity={activity}
            />
          )}
        </ResourceSurface>
      )}
    </>
  )
}
