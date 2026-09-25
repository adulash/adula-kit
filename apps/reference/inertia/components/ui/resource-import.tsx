import { useState } from 'react'
import { router } from '@inertiajs/react'
import axios from 'axios'
import { FileUp } from 'lucide-react'
import type { ImportBatch } from '@adula/kit'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

const json = { headers: { Accept: 'application/json' }, withXSRFToken: true }
const SKIP = '__skip__'

/** Upload a CSV, map its columns to writable fields, then queue the import. */
export function ResourceImport({ resource, label }: { resource: string; label: string }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [batch, setBatch] = useState<ImportBatch | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const reset = () => {
    setFile(null)
    setBatch(null)
    setMapping({})
    setError('')
  }
  const failure = (caught: unknown, fallback: string) =>
    setError(
      axios.isAxiosError(caught) && caught.response?.data?.error?.message
        ? String(caught.response.data.error.message)
        : fallback
    )
  const upload = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const response = await axios.post<{ data: ImportBatch }>(
        `/resources/${resource}/imports`,
        form,
        json
      )
      setBatch(response.data.data)
      setMapping(response.data.data.mapping)
    } catch (caught) {
      failure(caught, 'تعذر قراءة الملف.')
    } finally {
      setBusy(false)
    }
  }
  const start = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!batch) return
    setBusy(true)
    setError('')
    try {
      await axios.post(`/imports/${batch.id}/start`, { mapping }, json)
      setOpen(false)
      reset()
      router.visit('/imports')
    } catch (caught) {
      failure(caught, 'تعذر بدء الاستيراد.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileUp size={16} />
        استيراد CSV
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value)
          if (!value) reset()
        }}
      >
        <DialogContent dir="rtl" className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>استيراد إلى {label}</DialogTitle>
            <DialogDescription>
              {batch
                ? `طابِق أعمدة الملف (${batch.total} صفاً) مع الحقول، ثم ابدأ الاستيراد.`
                : 'ملف CSV بترميز UTF-8، صفه الأول عناوين الأعمدة، حتى 5000 صف.'}
            </DialogDescription>
          </DialogHeader>
          {!batch ? (
            <form id="import-upload" className="space-y-2" onSubmit={upload}>
              <Label htmlFor="import-file">الملف</Label>
              <Input
                id="import-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </form>
          ) : (
            <form
              id="import-mapping"
              className="max-h-96 space-y-3 overflow-y-auto"
              onSubmit={start}
            >
              {batch.headers.map((header, index) => (
                <div key={index} className="grid grid-cols-2 items-center gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{header || `عمود ${index + 1}`}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      مثال: {batch.sample[0]?.[index] || '—'}
                    </p>
                  </div>
                  <Select
                    value={mapping[String(index)] ?? SKIP}
                    onValueChange={(value) =>
                      setMapping((current) => {
                        const next = { ...current }
                        if (value === SKIP) delete next[String(index)]
                        else next[String(index)] = value
                        return next
                      })
                    }
                  >
                    <SelectTrigger aria-label={`حقل العمود ${header || index + 1}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SKIP}>تجاهل العمود</SelectItem>
                      {batch.targets.map((target) => (
                        <SelectItem key={target.key} value={target.key}>
                          {target.label}
                          {target.required ? ' *' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </form>
          )}
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            {batch ? (
              <Button type="submit" form="import-mapping" disabled={busy}>
                بدء الاستيراد
              </Button>
            ) : (
              <Button type="submit" form="import-upload" disabled={busy || !file}>
                رفع الملف
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
