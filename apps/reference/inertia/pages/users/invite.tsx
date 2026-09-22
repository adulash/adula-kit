import type { ReactElement } from 'react'
import { Head, useForm, usePage } from '@inertiajs/react'
import Workspace from '~/layouts/workspace'
import { ResourceSurface } from '~/components/ui/resource-surface'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

export default function Invite() {
  const page = usePage<{ isAdmin?: boolean }>()
  const form = useForm({ fullName: '', email: '', form: '' })
  return (
    <>
      <Head title="دعوة مستخدم" />
      <ResourceSurface
        title="إضافة مستخدم بدعوة بريدية"
        description="يختار المدعو كلمة مروره عبر رابط صالح لمدة 24 ساعة. يعيّن المدير الأدوار بعد قبول الدعوة."
        backHref={page.props.isAdmin ? '/admin/users' : '/'}
        mode="edit"
      >
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            form.post('/users/invite', { onSuccess: () => form.reset() })
          }}
        >
          {typeof page.flash.success === 'string' && (
            <p role="status" data-flash-message={page.flash.success}>
              {page.flash.success}
            </p>
          )}
          {form.errors.form && (
            <p role="alert" className="text-destructive">
              {form.errors.form}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="fullName">الاسم الكامل</Label>
            <Input
              id="fullName"
              required
              maxLength={120}
              value={form.data.fullName}
              onChange={(e) => form.setData('fullName', e.target.value)}
              aria-invalid={Boolean(form.errors.fullName)}
            />
            {form.errors.fullName && <p role="alert">{form.errors.fullName}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input
              id="email"
              type="email"
              dir="ltr"
              required
              maxLength={254}
              value={form.data.email}
              onChange={(e) => form.setData('email', e.target.value)}
              aria-invalid={Boolean(form.errors.email)}
            />
            {form.errors.email && <p role="alert">{form.errors.email}</p>}
          </div>
          <p className="text-sm text-muted-foreground">
            لإعادة إرسال دعوة لم تُقبل، أدخل البريد نفسه بعد دقيقة. يصبح الرابط السابق غير صالح.
          </p>
          <Button type="submit" disabled={form.processing}>
            {form.processing ? 'جارٍ الإرسال…' : 'إرسال الدعوة'}
          </Button>
        </form>
      </ResourceSurface>
    </>
  )
}
Invite.layout = (page: ReactElement) => <Workspace>{page}</Workspace>
