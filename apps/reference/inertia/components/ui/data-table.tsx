import { useRef, useState, type ComponentRef, type ReactNode } from 'react'
import { InfiniteScroll, router, usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { tableFeatures, useTable } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import axios from 'axios'
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Download,
  Inbox,
  Loader2,
  Bookmark,
  BookmarkPlus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import type {
  ResourceDescription,
  ResourceField,
  ResourceList,
  SavedView,
  SavedViewQuery,
  SerializedRecord,
} from '@adula/kit'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { useUiPreferences } from '~/components/ui/ui-preferences'
import { Can } from '~/components/ui/can'
import { Input } from '~/components/ui/input'
import { ResourceActions } from '~/components/ui/resource-actions'
import { FieldControl } from '~/components/ui/resource-field'
import {
  csvCell,
  displayValue,
  parseValue,
  relationLabel,
  type LookupOptions,
  type Option,
} from '~/components/ui/resource-value'

/** Rows above this count render through the virtualizer (plan section 13). */
export const VIRTUAL_ROWS = 200
const ROW_HEIGHT = 52
const PAGE_SIZE = 100
const features = tableFeatures({})
type Query = Record<string, string | undefined>

export function DataTable({
  resource,
  result,
  lookups = {},
  savedViews = [],
}: {
  resource: ResourceDescription
  result: ResourceList
  lookups?: LookupOptions
  savedViews?: SavedView[]
}) {
  const { calendar } = useUiPreferences()
  const { url } = usePage()
  const query = new URL(url, 'http://localhost').searchParams
  const [search, setSearch] = useState(query.get('search') ?? '')
  const [failure, setFailure] = useState('')
  const container = useRef<HTMLDivElement>(null)
  const scroller = useRef<ComponentRef<typeof InfiniteScroll>>(null)
  // Inertia merges `result.data` page by page; permissions and labels of earlier pages accumulate here.
  const store = useRef<{
    source: ResourceList | null
    permissions: ResourceList['permissions']
    related: ResourceList['related']
  }>({ source: null, permissions: {}, related: {} })
  if (store.current.source !== result) {
    const related = { ...store.current.related }
    for (const [key, rows] of Object.entries(result.related))
      related[key] = [
        ...new Map([...(related[key] ?? []), ...rows].map((row) => [String(row.id), row])).values(),
      ]
    store.current = {
      source: result,
      permissions: { ...store.current.permissions, ...result.permissions },
      related,
    }
  }
  const { permissions, related } = store.current
  const fields = resource.fields.filter(
    (field) => resource.list.includes(field.key) && field.type !== 'hasMany'
  )
  const filterable = fields.filter((field) => field.filterable)
  const table = useTable({
    features,
    data: result.data,
    columns: fields.map((field) => ({ accessorKey: field.key, id: field.key })),
    getRowId: (row) => String(row.id),
  })
  const rows = table.getRowModel().rows
  const virtualized = rows.length > VIRTUAL_ROWS
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => container.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    enabled: virtualized,
    getItemKey: (index) => rows[index].id,
  })
  const items = virtualized
    ? virtual.getVirtualItems()
    : rows.map((_, index) => ({ index, start: 0, end: 0 }))
  const navigate = (changes: Query) => {
    const next = new URLSearchParams(query)
    next.delete('cursor')
    for (const [key, value] of Object.entries(changes))
      value ? next.set(key, value) : next.delete(key)
    const suffix = next.toString()
    router.get(
      `/resources/${resource.name}${suffix ? `?${suffix}` : ''}`,
      {},
      { preserveScroll: true }
    )
  }
  const sort = query.get('sort')
  const direction = query.get('direction') === 'desc' ? 'desc' : 'asc'
  const activeFilters = filterable.filter((field) => query.get(`filters[${field.key}]`))
  const csv = () => {
    const content = [
      fields.map((field) => field.label.ar),
      ...result.data.map((row) =>
        fields.map((field) => displayValue(field, row, related, lookups, calendar))
      ),
    ]
    const href = URL.createObjectURL(
      new Blob(['﻿' + content.map((row) => row.map(csvCell).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      })
    )
    const link = document.createElement('a')
    link.href = href
    link.download = `${resource.label}.csv`
    link.click()
    URL.revokeObjectURL(href)
  }
  const refresh = () => router.visit(url, { preserveScroll: true })
  const currentQuery = (): SavedViewQuery => {
    const view: SavedViewQuery = {}
    const text = query.get('search')
    if (text) view.search = text
    if (sort) {
      view.sort = sort
      view.direction = direction
    }
    const filters: Record<string, string> = {}
    for (const field of filterable) {
      const value = query.get(`filters[${field.key}]`)
      if (value) filters[field.key] = value
    }
    if (Object.keys(filters).length) view.filters = filters
    return view
  }
  const applyView = (view: SavedView) => {
    const next = new URLSearchParams()
    if (view.query.search) next.set('search', view.query.search)
    if (view.query.sort) {
      next.set('sort', view.query.sort)
      next.set('direction', view.query.direction ?? 'asc')
    }
    for (const [key, value] of Object.entries(view.query.filters ?? {}))
      if (value !== null) next.set(`filters[${key}]`, String(value))
    setSearch(view.query.search ?? '')
    const suffix = next.toString()
    router.get(
      `/resources/${resource.name}${suffix ? `?${suffix}` : ''}`,
      {},
      { preserveScroll: true }
    )
  }
  return (
    <section
      aria-label={`قائمة ${resource.label}`}
      className="min-w-0 overflow-hidden rounded-xl border border-border bg-white shadow-[0_2px_10px_#1c302804]"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">سجل {resource.label}</h2>
          <Badge variant="secondary" className="font-normal tabular-nums">
            {rows.length} معروض
          </Badge>
          <span className="text-xs text-muted-foreground">
            {result.meta.estimatedTotal !== undefined
              ? `نحو ${result.meta.estimatedTotal} سجل ضمن نطاقك`
              : 'حسب نطاق صلاحياتك'}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={csv} disabled={!rows.length}>
          <Download size={15} />
          تصدير المعروض
        </Button>
      </div>
      {(resource.searchable || filterable.length > 0) && (
        <SavedViewsBar
          resource={resource}
          views={savedViews}
          current={currentQuery}
          onApply={applyView}
          onChanged={refresh}
          onFailure={setFailure}
        />
      )}
      {(resource.searchable || filterable.length > 0) && (
        <div className="flex flex-wrap items-end gap-3 border-b px-5 py-4">
          {resource.searchable && (
            <form
              role="search"
              className="relative w-full max-w-sm"
              onSubmit={(event) => {
                event.preventDefault()
                navigate({ search })
              }}
            >
              <Search
                className="pointer-events-none absolute start-3 top-2.5 text-muted-foreground"
                size={16}
              />
              <Input
                aria-label={`البحث في ${resource.label}`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ابحث في السجلات..."
                className="h-9 bg-background/60 ps-10 text-xs"
              />
            </form>
          )}
          {filterable.length > 0 && (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <SlidersHorizontal size={15} />
              تصفية
            </span>
          )}
          {filterable.map((field) => (
            <Filter
              key={field.key}
              field={field}
              value={query.get(`filters[${field.key}]`) ?? ''}
              options={lookups[field.key]}
              onApply={(value) => navigate({ [`filters[${field.key}]`]: value })}
            />
          ))}
          {activeFilters.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                navigate(
                  Object.fromEntries(
                    activeFilters.map((field) => [`filters[${field.key}]`, undefined])
                  )
                )
              }
            >
              <X size={14} />
              مسح التصفية
            </Button>
          )}
        </div>
      )}
      <InfiniteScroll
        ref={(instance) => {
          scroller.current = instance
        }}
        data="result"
        manual
        onlyNext
        preserveUrl
        params={{
          data: { limit: PAGE_SIZE },
          onBefore: () => {
            setFailure('')
          },
          onHttpException: () => {
            setFailure('تعذر تحميل السجلات التالية. أعد المحاولة.')
            return false
          },
          onNetworkError: () => {
            setFailure('تعذر الاتصال بالخادم. تحقق من الاتصال ثم أعد المحاولة.')
            return false
          },
        }}
        next={({ fetch, loading, hasMore }) => (
          <div className="flex flex-wrap items-center justify-center gap-4 border-t px-5 py-3 text-xs text-muted-foreground">
            {failure && (
              <p role="alert" className="text-destructive">
                {failure}
              </p>
            )}
            {loading ? (
              <span role="status" className="inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                جارٍ تحميل المزيد...
              </span>
            ) : hasMore ? (
              <Button variant="ghost" size="sm" onClick={fetch}>
                تحميل المزيد
              </Button>
            ) : (
              <span>{rows.length ? 'نهاية السجلات' : ''}</span>
            )}
          </div>
        )}
      >
        <div
          ref={container}
          data-slot="table-scroll"
          className="max-h-[600px] overflow-auto"
          onScroll={(event) => {
            const element = event.currentTarget
            if (
              !failure &&
              element.scrollHeight - element.scrollTop - element.clientHeight < 200 &&
              scroller.current?.hasNext()
            )
              scroller.current.fetchNext()
          }}
        >
          <table
            className="w-full min-w-[720px] text-start text-sm"
            aria-rowcount={rows.length + 1}
            aria-label={resource.label}
          >
            <thead className="sticky top-0 z-10 bg-muted text-xs text-muted-foreground">
              <tr>
                {fields.map((field) => (
                  <th
                    key={field.key}
                    scope="col"
                    className="h-11 whitespace-nowrap px-5 text-start font-medium"
                    aria-sort={
                      sort === field.key
                        ? direction === 'desc'
                          ? 'descending'
                          : 'ascending'
                        : undefined
                    }
                  >
                    {field.sortable ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 hover:text-foreground"
                        onClick={() =>
                          navigate({
                            sort: field.key,
                            direction: sort === field.key && direction === 'asc' ? 'desc' : 'asc',
                          })
                        }
                      >
                        {field.label.ar}
                        {sort === field.key ? (
                          direction === 'desc' ? (
                            <ArrowDown size={12} />
                          ) : (
                            <ArrowUp size={12} />
                          )
                        ) : (
                          <ArrowDownUp size={12} className="opacity-60" />
                        )}
                      </button>
                    ) : (
                      field.label.ar
                    )}
                  </th>
                ))}
                <th scope="col" className="px-5 text-start font-medium">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody>
              {virtualized && items[0] && items[0].start > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={fields.length + 1} style={{ height: items[0].start }} />
                </tr>
              )}
              {items.map(({ index }) => {
                const row = rows[index].original
                const id = String(row.id)
                return (
                  <tr
                    key={id}
                    aria-rowindex={index + 2}
                    className="border-b last:border-0 hover:bg-background"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {fields.map((field) => (
                      <Cell
                        key={field.key}
                        field={field}
                        row={row}
                        related={related}
                        lookups={lookups}
                      />
                    ))}
                    <td className="whitespace-nowrap px-5 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link
                            href={`/resources/${resource.name}/${id}`}
                            aria-label={`عرض السجل ${id}`}
                          >
                            عرض
                          </Link>
                        </Button>
                        <Can permissions={permissions[id] ?? {}} action="update">
                          <Button variant="ghost" size="sm" asChild>
                            <Link
                              href={`/resources/${resource.name}/${id}/edit`}
                              aria-label={`تعديل السجل ${id}`}
                            >
                              تعديل
                            </Link>
                          </Button>
                        </Can>
                        <ResourceActions
                          resource={resource.name}
                          id={id}
                          version={row.version ?? undefined}
                          permissions={permissions[id] ?? {}}
                          label={`السجل ${id}`}
                          size="sm"
                          variant="ghost"
                          onDone={refresh}
                        />
                      </span>
                    </td>
                  </tr>
                )
              })}
              {virtualized && (
                <tr aria-hidden="true">
                  <td
                    colSpan={fields.length + 1}
                    style={{
                      height: Math.max(0, virtual.getTotalSize() - (items.at(-1)?.end ?? 0)),
                    }}
                  />
                </tr>
              )}
              {!rows.length && (
                <tr>
                  <td colSpan={fields.length + 1} className="py-16 text-center">
                    <Inbox
                      className="mx-auto mb-3 text-muted-foreground"
                      size={30}
                      strokeWidth={1.3}
                    />
                    <p className="text-sm font-medium">لا توجد سجلات مطابقة</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {query.get('search') || activeFilters.length
                        ? 'غيّر البحث أو التصفية لعرض سجلات أخرى.'
                        : 'لم تُضف سجلات ضمن نطاقك بعد.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </InfiniteScroll>
    </section>
  )
}

/** Presets over the same query keys the list already accepts; the kit validates every one. */
function SavedViewsBar({
  resource,
  views,
  current,
  onApply,
  onChanged,
  onFailure,
}: {
  resource: ResourceDescription
  views: SavedView[]
  current: () => SavedViewQuery
  onApply: (view: SavedView) => void
  onChanged: () => void
  onFailure: (message: string) => void
}) {
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [shared, setShared] = useState(false)
  const [busy, setBusy] = useState(false)
  const base = `/resources/${resource.name}/views`
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    onFailure('')
    try {
      await axios.post(
        base,
        { name, query: current(), shared },
        { headers: { Accept: 'application/json' }, withXSRFToken: true }
      )
      setNaming(false)
      setName('')
      setShared(false)
      onChanged()
    } catch (error) {
      onFailure(
        axios.isAxiosError(error) && error.response?.data?.error?.message
          ? String(error.response.data.error.message)
          : 'تعذر حفظ العرض.'
      )
    } finally {
      setBusy(false)
    }
  }
  const remove = async (view: SavedView) => {
    setBusy(true)
    onFailure('')
    try {
      await axios.delete(`${base}/${view.id}`, {
        headers: { Accept: 'application/json' },
        withXSRFToken: true,
      })
      onChanged()
    } catch {
      onFailure('تعذر حذف العرض.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <Bookmark size={15} />
        العروض المحفوظة
      </span>
      {views.length === 0 && <span className="text-xs text-muted-foreground">لا عروض بعد</span>}
      {views.map((view) => (
        <span
          key={view.id}
          className="flex items-center gap-1 rounded-full border border-border bg-background/60 ps-1 pe-3"
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-7 rounded-full px-2 text-xs"
            onClick={() => onApply(view)}
          >
            {view.name}
            {!view.own && <span className="text-muted-foreground"> · مشترك</span>}
          </Button>
          {view.own && (
            <button
              type="button"
              aria-label={`حذف العرض ${view.name}`}
              disabled={busy}
              onClick={() => remove(view)}
              className="text-muted-foreground transition-colors hover:text-destructive"
            >
              <X size={13} />
            </button>
          )}
        </span>
      ))}
      {naming ? (
        <form onSubmit={save} className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="اسم العرض"
            value={name}
            autoFocus
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            placeholder="اسم العرض"
            className="h-8 w-44 text-xs"
          />
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={shared}
              onChange={(event) => setShared(event.target.checked)}
            />
            مشترك
          </label>
          <Button type="submit" size="sm" className="h-8" disabled={busy || !name.trim()}>
            حفظ
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => setNaming(false)}
          >
            إلغاء
          </Button>
        </form>
      ) : (
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setNaming(true)}>
          <BookmarkPlus size={14} />
          حفظ العرض الحالي
        </Button>
      )}
    </div>
  )
}

function Cell({
  field,
  row,
  related,
  lookups,
}: {
  field: ResourceField
  row: SerializedRecord
  related: ResourceList['related']
  lookups: LookupOptions
}) {
  const { calendar } = useUiPreferences()
  const text = displayValue(field, row, related, lookups, calendar)
  const numeric = ['money', 'integer', 'date', 'datetime'].includes(field.type)
  return (
    <td
      className={`max-w-[280px] truncate px-5 ${numeric ? 'tabular-nums' : ''}`}
      dir={numeric ? 'ltr' : undefined}
      title={text}
    >
      {field.type === 'boolean' && row[field.key] !== null && row[field.key] !== undefined ? (
        <Badge variant={row[field.key] ? 'default' : 'secondary'}>{text}</Badge>
      ) : (
        text
      )}
    </td>
  )
}

function Filter({
  field,
  value,
  options,
  onApply,
}: {
  field: ResourceField
  value: string
  options?: Option[]
  onApply: (value: string | undefined) => void
}): ReactNode {
  const [draft, setDraft] = useState(value)
  const id = `filter-${field.key}`
  const select = (choices: Option[]) => (
    <select
      id={id}
      className="h-9 rounded-md border border-input bg-white px-3 text-xs"
      value={value}
      onChange={(event) => onApply(event.target.value || undefined)}
    >
      <option value="">الكل</option>
      {choices.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-xs text-muted-foreground">
      {field.label.ar}
      {field.type === 'lookup' ? (
        select(options ?? [])
      ) : field.type === 'boolean' ? (
        select([
          { value: 'true', label: 'نعم' },
          { value: 'false', label: 'لا' },
        ])
      ) : field.type === 'belongsTo' ? (
        <RelationFilter field={field} value={value} onApply={onApply} />
      ) : field.type === 'date' ? (
        <div className="w-56">
          <FieldControl
            field={field}
            id={id}
            value={draft}
            label={`تصفية ${field.label.ar}`}
            onChange={(next) => {
              setDraft(next)
              try {
                const parsed = parseValue(field, next)
                onApply(parsed ? String(parsed) : undefined)
              } catch {
                // Keep partial or invalid input without issuing an invalid date query.
              }
            }}
          />
        </div>
      ) : (
        <Input
          id={id}
          className="h-9 w-44 text-xs"
          value={draft}
          placeholder="اضغط Enter للتطبيق"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onApply(draft || undefined)
            }
          }}
        />
      )}
    </label>
  )
}

/** Filters by a related record through the target list route, which enforces the target's own rules. */
function RelationFilter({
  field,
  value,
  onApply,
}: {
  field: ResourceField & { type: 'belongsTo' }
  value: string
  onApply: (value: string | undefined) => void
}) {
  const [term, setTerm] = useState('')
  const [choices, setChoices] = useState<Option[]>([])
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const load = async (search: string) => {
    setBusy(true)
    try {
      const response = await axios.get<ResourceList>(`/resources/${field.resource}`, {
        params: { limit: 50, estimate: 'false', ...(search ? { search } : {}) },
        headers: { Accept: 'application/json' },
      })
      setChoices(
        response.data.data.map((row) => ({
          value: String(row.id),
          label: relationLabel(row, row.id),
        }))
      )
    } catch {
      setChoices([])
    } finally {
      setBusy(false)
    }
  }
  return (
    <span className="flex items-center gap-2">
      <Input
        id={`filter-${field.key}`}
        className="h-9 w-44 text-xs"
        value={term}
        placeholder={value ? `#${value} · ابحث للتغيير` : 'ابحث في السجلات المرتبطة'}
        onChange={(event) => {
          setTerm(event.target.value)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => void load(event.target.value), 300)
        }}
        onFocus={() => {
          if (!choices.length) void load('')
        }}
      />
      <select
        aria-label={`اختيار ${field.label.ar}`}
        className="h-9 max-w-44 rounded-md border border-input bg-white px-2 text-xs"
        value={value}
        disabled={busy && !choices.length}
        onChange={(event) => onApply(event.target.value || undefined)}
      >
        <option value="">{busy ? 'جارٍ البحث...' : 'الكل'}</option>
        {value && !choices.some((choice) => choice.value === value) && (
          <option value={value}>#{value}</option>
        )}
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </span>
  )
}
