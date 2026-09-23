import { Head, useForm } from '@inertiajs/react'
import { ResourceSurface } from '~/components/ui/resource-surface'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

export default function Invitation({ token, valid }: { token: string; valid: boolean }) {
  const form = useForm({ password: '', passwordConfirmation: '', form: '' })
  return (
    <>
      <Head title="قبول الدعوة" />
      <ResourceSurface
        title="مرحبًا بك — أنشئ حسابك"
        description="اختر كلمة مرور خاصة بك لقبول الدعوة. يعيّن المسؤول صلاحيات العمل لحسابك."
        backHref="/login"
        mode="edit"
      >
        {valid ? (
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              form.post(`/invitations/${encodeURIComponent(token)}`)
            }}
          >
            {form.errors.form && (
              <p role="alert" className="text-destructive">
                {form.errors.form}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                dir="ltr"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={64}
                value={form.data.password}
                onChange={(e) => form.setData('password', e.target.value)}
                aria-invalid={Boolean(form.errors.password)}
              />
              {form.errors.password && <p role="alert">{form.errors.password}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="passwordConfirmation">تأكيد كلمة المرور</Label>
              <Input
                id="passwordConfirmation"
                type="password"
                dir="ltr"
                autoComplete="new-password"
                required
                value={form.data.passwordConfirmation}
                onChange={(e) => form.setData('passwordConfirmation', e.target.value)}
                aria-invalid={Boolean(form.errors.passwordConfirmation)}
              />
              {form.errors.passwordConfirmation && (
                <p role="alert">{form.errors.passwordConfirmation}</p>
              )}
            </div>
            <Button type="submit" disabled={form.processing}>
              {form.processing ? 'جارٍ إنشاء الحساب…' : 'إنشاء حسابي'}
            </Button>
          </form>
        ) : (
          <p role="alert">
            الدعوة غير صالحة أو انتهت صلاحيتها أو استُخدمت. اطلب دعوة جديدة من المسؤول.
          </p>
        )}
      </ResourceSurface>
    </>
  )
}
