import { useState, type FormEvent } from 'react'
import { router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import axios from 'axios'
import { toast } from 'sonner'
import { RefreshCw, Save } from 'lucide-react'
import type { RecordPermissions, ResourceEditor, ResourceField as Field } from '@adula/kit'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { ResourceActions, failureMessage, isConflict } from '~/components/ui/resource-actions'
import {
  InlineRows,
  ResourceField,
  ResourceSelect,
  type InlineRow,
} from '~/components/ui/resource-field'
import { Label } from '~/components/ui/label'
import { inputValue, isAttachment, parseValue } from '~/components/ui/resource-value'

type Failure = { message: string; conflict: boolean }
type RowErrors = Record<string, Record<string, Record<string, string>>>
type ServerError = { field?: string; message: string }

function initialValue(field: Field, value: unknown) {
  if (field.type === 'boolean' && (value === null || value === undefined)) return 'false'
  return inputValue(field, value)
}

export function ResourceForm({
  editor,
  permissions = {},
}: {
  editor: ResourceEditor
  permissions?: RecordPermissions
}) {
  const base = `/resources/${editor.name}`
  const scalar = editor.fields.filter((field) => field.type !== 'hasMany')
  const inlineFields = editor.fields.filter(
    (field) => field.type === 'hasMany' && field.inline && editor.inline[field.key]
  )
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      scalar.map((field) => [field.key, initialValue(field, editor.record?.[field.key])])
    )
  )
  const [rows, setRows] = useState<Record<string, InlineRow[]>>(() =>
    Object.fromEntries(
      inlineFields.map((field) => {
        const definition = editor.inline[field.key]
        return [
          field.key,
          definition.rows.map((row) => ({
            key: `row-${row.id}`,
            id: Number(row.id),
            version:
              row.version === undefined || row.version === null ? undefined : Number(row.version),
            values: Object.fromEntries(
              definition.fields.map((child) => [child.key, initialValue(child, row[child.key])])
            ),
          })),
        ]
      })
    )
  )
  const [unit, setUnit] = useState(
    String(editor.record?.orgUnitId ?? editor.orgUnits[0]?.value ?? '')
  )
  const [failure, setFailure] = useState<Failure | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [rowErrors, setRowErrors] = useState<RowErrors>({})
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const inlinePayload = (field: Field, collected: RowErrors) => {
    const definition = editor.inline[field.key]
    const list = rows[field.key] ?? []
    const changed = list.filter((row) =>
      row.id === undefined ? !row.deleted : Boolean(row.dirty || row.deleted)
    )
    const payload = changed.map((row) => {
      if (row.deleted) return { id: row.id, version: row.version, _delete: true }
      const allowed =
        row.id === undefined
          ? definition.createFields
          : (definition.updateFields[String(row.id)] ?? [])
      const entry: Record<string, unknown> =
        row.id === undefined ? {} : { id: row.id, version: row.version }
      for (const child of definition.fields) {
        if (!allowed.includes(child.key)) continue
        const raw = row.values[child.key] ?? ''
        if (raw === '' && !child.required && row.id === undefined) continue
        try {
          const parsed = parseValue(child, raw)
          if (parsed === null && child.required) throw new Error('هذا الحقل مطلوب')
          entry[child.key] = parsed
        } catch (error) {
          collected[field.key] ??= {}
          collected[field.key][row.key] ??= {}
          collected[field.key][row.key][child.key] = (error as Error).message
        }
      }
      return entry
    })
    return changed.length ? payload : undefined
  }

  const mapServerErrors = (entries: ServerError[]) => {
    const fieldErrors: Record<string, string> = {}
    const sections: Record<string, string> = {}
    const unknown: string[] = []
    for (const entry of entries) {
      const key = entry.field ?? ''
      if (scalar.some((field) => field.key === key)) {
        fieldErrors[key] = entry.message
        continue
      }
      const section = inlineFields.find((field) =>
        editor.inline[field.key].fields.some(
          (child) => child.key === key || key.endsWith(`.${child.key}`)
        )
      )
      if (section) {
        const child = editor.inline[section.key].fields.find(
          (candidate) => candidate.key === key || key.endsWith(`.${candidate.key}`)
        )
        // Nested validators report the child field only, never which row; surface it on the section.
        sections[section.key] = `${child?.label.ar ?? key}: ${entry.message}`
        continue
      }
      unknown.push(key ? `${key}: ${entry.message}` : entry.message)
    }
    setErrors(fieldErrors)
    setSectionErrors(sections)
    return unknown
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setFailure(null)
    setErrors({})
    setRowErrors({})
    setSectionErrors({})
    const payload: Record<string, unknown> = {}
    const fieldErrors: Record<string, string> = {}
    const collected: RowErrors = {}
    for (const field of editor.fields) {
      if (field.type === 'hasMany') {
        if (!editor.inline[field.key]) continue
        const inline = inlinePayload(field, collected)
        if (inline) payload[field.key] = inline
        continue
      }
      const raw = values[field.key] ?? ''
      // Updates submit the whole form: the resource validator checks the submitted
      // document, and `version` — not a partial payload — protects concurrent edits.
      if (editor.mode === 'create' && raw === '' && !field.required) continue
      try {
        const parsed = parseValue(field, raw)
        if (parsed === null && field.required) throw new Error('هذا الحقل مطلوب')
        payload[field.key] = parsed
      } catch (error) {
        fieldErrors[field.key] = (error as Error).message
      }
    }
    if (Object.keys(fieldErrors).length || Object.keys(collected).length) {
      setErrors(fieldErrors)
      setRowErrors(collected)
      setFailure({ message: 'راجع الحقول المحددة ثم أعد المحاولة.', conflict: false })
      return
    }
    if (editor.scoped) payload.orgUnitId = Number(unit)
    if (editor.record?.version !== undefined && editor.record.version !== null)
      payload.version = editor.record.version
    setBusy(true)
    try {
      const response = await axios.request<{ data: { id: number } }>({
        method: editor.mode === 'create' ? 'post' : 'patch',
        url: base + (editor.record ? `/${editor.record.id}` : ''),
        data: payload,
        headers: { Accept: 'application/json' },
        withXSRFToken: true,
      })
      toast.success(editor.mode === 'create' ? 'تمت إضافة السجل' : 'تم حفظ التعديلات')
      router.visit(`${base}/${response.data.data.id}`)
    } catch (error) {
      const unknown =
        axios.isAxiosError(error) && Array.isArray(error.response?.data?.errors)
          ? mapServerErrors(error.response.data.errors as ServerError[])
          : []
      const conflict = isConflict(error)
      setFailure({
        conflict,
        message: conflict
          ? 'تغير السجل منذ فتحه. احتفظ بتعديلاتك ثم أعد تحميل الصفحة.'
          : unknown.length
            ? unknown.join(' · ')
            : failureMessage(error, 'تعذر الحفظ. راجع البيانات وحاول مجدداً.'),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-4xl space-y-6" aria-busy={busy}>
      {failure && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>{failure.conflict ? 'تعارض في الإصدار' : 'تعذر الحفظ'}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            {failure.message}
            {failure.conflict && (
              <Button type="button" variant="outline" size="sm" onClick={() => router.reload()}>
                <RefreshCw size={14} />
                إعادة التحميل
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      <section className="rounded-xl border bg-white">
        <div className="border-b px-7 py-5">
          <h2 className="text-sm font-semibold">تفاصيل السجل</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            الحقول المتاحة بحسب صلاحياتك · الحقول المعلّمة بـ{' '}
            <span className="text-destructive">*</span> مطلوبة
          </p>
        </div>
        <div className="grid gap-6 p-7 md:grid-cols-2">
          {editor.scoped && (
            <div className="min-w-0 space-y-2">
              <Label htmlFor="orgUnitId" className="flex items-center gap-2 text-sm font-medium">
                الوحدة التنظيمية
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
              </Label>
              <ResourceSelect
                id="orgUnitId"
                required
                value={unit}
                disabled={busy}
                onChange={setUnit}
                options={editor.orgUnits}
              />
            </div>
          )}
          {scalar.map((field) => {
            const stored = editor.record?.[field.key]
            return (
              <ResourceField
                key={field.key}
                field={field}
                id={field.key}
                value={values[field.key] ?? ''}
                options={editor.options[field.key]}
                error={errors[field.key]}
                disabled={busy}
                resource={editor.name}
                attachment={field.type === 'attachment' && isAttachment(stored) ? stored : null}
                onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
                relation={
                  field.type === 'belongsTo'
                    ? {
                        url: `${base}/options/${field.key}${editor.record ? `?id=${editor.record.id}` : ''}`,
                        searchable: editor.relationSearch[field.key] ?? false,
                      }
                    : undefined
                }
              />
            )
          })}
        </div>
      </section>
      {inlineFields.map((field) => (
        <InlineRows
          key={field.key}
          field={field}
          inline={editor.inline[field.key]}
          rows={rows[field.key] ?? []}
          errors={rowErrors[field.key]}
          sectionError={sectionErrors[field.key]}
          disabled={busy}
          resource={editor.name}
          onChange={(next) => setRows((current) => ({ ...current, [field.key]: next }))}
        />
      ))}
      {editor.record?.version !== undefined && editor.record.version !== null && (
        <input type="hidden" name="version" value={String(editor.record.version)} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {editor.record && (
            <ResourceActions
              resource={editor.name}
              id={editor.record.id as number}
              version={editor.record.version ?? undefined}
              permissions={permissions}
              onDone={(action) =>
                router.visit(action === 'delete' ? base : `${base}/${editor.record?.id}`)
              }
            />
          )}
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href={editor.record ? `${base}/${editor.record.id}` : base}>إلغاء</Link>
          </Button>
          <Button type="submit" disabled={busy}>
            <Save size={16} />
            {busy ? 'جارٍ الحفظ...' : 'حفظ السجل'}
          </Button>
        </div>
      </div>
    </form>
  )
}
