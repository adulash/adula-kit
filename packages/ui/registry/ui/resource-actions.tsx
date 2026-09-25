import { useState } from 'react'
import { router } from '@inertiajs/react'
import axios from 'axios'
import { toast } from 'sonner'
import type { RecordPermissions } from '@adula/kit'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Can } from '~/components/ui/can'

export type TransitionAction = 'delete' | 'submit' | 'cancel' | 'amend'
export const transitionLabels: Record<TransitionAction, string> = {
  delete: 'حذف السجل',
  submit: 'اعتماد المستند',
  cancel: 'إلغاء الاعتماد',
  amend: 'تعديل بالنسخ',
}
const descriptions: Record<TransitionAction, string> = {
  delete: 'سيُخفى السجل من القوائم ولن يمكن تعديله بعد الحذف.',
  submit: 'بعد الاعتماد لا يمكن تعديل المستند أو بنوده.',
  cancel: 'سيُعاد المستند إلى حالة الإلغاء ولن يُحتسب.',
  amend: 'تُنشأ مسودة جديدة منسوخة من هذا المستند الملغي مع بنوده، ويبقى الأصل كما هو.',
}

export function failureMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return 'تعذر الاتصال بالخادم. حاول مجدداً.'
  if (error.response?.status === 409 && error.response.data?.error?.code === 'E_VERSION_CONFLICT')
    return 'تغير السجل منذ فتحه. أعد تحميل الصفحة قبل المتابعة.'
  return error.response?.data?.error?.message ?? fallback
}

export function isConflict(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 409
}

/** Version travels with every transition so a stale page cannot delete or approve a changed record. */
export function ResourceActions({
  resource,
  id,
  version,
  permissions,
  label,
  size = 'default',
  variant = 'outline',
  onDone,
}: {
  resource: string
  id: number | string
  version?: unknown
  permissions: RecordPermissions
  label?: string
  size?: 'default' | 'sm'
  variant?: 'outline' | 'ghost'
  onDone?: (action: TransitionAction) => void
}) {
  const [pending, setPending] = useState<TransitionAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [conflict, setConflict] = useState(false)
  const base = `/resources/${resource}/${id}`
  const execute = async () => {
    if (!pending) return
    setBusy(true)
    setFailure('')
    try {
      const response = await axios.request({
        method: pending === 'delete' ? 'delete' : 'post',
        url: pending === 'delete' ? base : `${base}/${pending}`,
        data: version === undefined ? {} : { version },
        headers: { Accept: 'application/json' },
        withXSRFToken: true,
      })
      toast.success(`تم ${transitionLabels[pending]}`)
      const done = pending
      setPending(null)
      // The amended copy is a new draft; continue editing it.
      if (done === 'amend') router.visit(`/resources/${resource}/${response.data.data.id}/edit`)
      else if (onDone) onDone(done)
      else if (done === 'delete') router.visit(`/resources/${resource}`)
      else router.reload()
    } catch (error) {
      setConflict(isConflict(error))
      setFailure(failureMessage(error, 'تعذر تنفيذ الإجراء. تحقق من صلاحياتك وحاول مجدداً.'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      {(['submit', 'cancel', 'amend', 'delete'] as const).map((action) => (
        <Can key={action} permissions={permissions} action={action}>
          <Button
            type="button"
            variant={variant}
            size={size}
            className={action === 'delete' ? 'text-destructive' : undefined}
            aria-label={label ? `${transitionLabels[action]} ${label}` : undefined}
            onClick={() => {
              setPending(action)
              setFailure('')
              setConflict(false)
            }}
          >
            {transitionLabels[action]}
          </Button>
        </Can>
      ))}
      <Dialog open={pending !== null} onOpenChange={(open) => !open && !busy && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending ? transitionLabels[pending] : ''}</DialogTitle>
            <DialogDescription>
              {pending ? descriptions[pending] : ''}
              {label ? ` (${label})` : ''}
            </DialogDescription>
          </DialogHeader>
          {failure && (
            <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
              {failure}
              {conflict && (
                <Button type="button" variant="outline" size="sm" onClick={() => router.reload()}>
                  إعادة التحميل
                </Button>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setPending(null)}>
              تراجع
            </Button>
            <Button
              type="button"
              variant={pending === 'delete' ? 'destructive' : 'default'}
              disabled={busy || conflict}
              onClick={() => void execute()}
            >
              {busy ? 'جارٍ التنفيذ...' : 'تأكيد'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
