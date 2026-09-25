import { useState, type ReactElement } from 'react'
import { Head, router } from '@inertiajs/react'
import axios from 'axios'
import { ShieldCheck, ShieldOff } from 'lucide-react'
import type { TwoFactorStatus } from '@adula/kit'
import Workspace from '~/layouts/workspace'
import { Badge } from '~/components/ui/badge'
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

type Props = { status: TwoFactorStatus }
type Step = 'enroll' | 'codes' | 'disable' | 'regenerate' | null
const json = { headers: { Accept: 'application/json' }, withXSRFToken: true }

export default function TwoFactorSettings({ status }: Props) {
  const [step, setStep] = useState<Step>(null)
  const [enrollment, setEnrollment] = useState<{ otpauthUrl: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [codes, setCodes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fail = (caught: unknown, fallback: string) =>
    setError(
      axios.isAxiosError(caught) && caught.response?.data?.error?.message
        ? String(caught.response.data.error.message)
        : fallback
    )
  const close = () => {
    setStep(null)
    setCode('')
    setPassword('')
    setError('')
    router.reload({ only: ['status'] })
  }
  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (caught) {
      fail(caught, fallback)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Head title="التحقق الثنائي" />
      <div className="mb-8 max-w-2xl">
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          التحقق الثنائي
          <Badge variant={status.enabled ? 'default' : 'secondary'}>
            {status.enabled ? 'مفعّل' : 'غير مفعّل'}
          </Badge>
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          يطلب النظام بعد كلمة المرور رمزاً مؤقتاً من تطبيق مصادقة على هاتفك.
          {status.enabled && ` رموز الاسترداد المتبقية: ${status.recoveryRemaining}.`}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {status.enabled ? (
          <>
            <Button variant="outline" onClick={() => setStep('regenerate')}>
              إنشاء رموز استرداد جديدة
            </Button>
            <Button variant="destructive" onClick={() => setStep('disable')}>
              <ShieldOff size={16} />
              إيقاف التحقق الثنائي
            </Button>
          </>
        ) : (
          <Button
            onClick={() =>
              run(async () => {
                const response = await axios.post('/account/two-factor', {}, json)
                setEnrollment(response.data.data)
                setStep('enroll')
              }, 'تعذر بدء التفعيل.')
            }
            disabled={busy}
          >
            <ShieldCheck size={16} />
            تفعيل التحقق الثنائي
          </Button>
        )}
      </div>

      <Dialog open={step !== null} onOpenChange={(value) => !value && close()}>
        <DialogContent dir="rtl">
          {step === 'enroll' && enrollment && (
            <>
              <DialogHeader>
                <DialogTitle>تفعيل التحقق الثنائي</DialogTitle>
                <DialogDescription>
                  أضف الحساب إلى تطبيق المصادقة بالمفتاح التالي أو بفتح الرابط على هاتفك، ثم أدخل
                  الرمز الظاهر.
                </DialogDescription>
              </DialogHeader>
              <code dir="ltr" className="block break-all rounded-lg bg-muted px-3 py-2 text-sm">
                {enrollment.secret}
              </code>
              <a href={enrollment.otpauthUrl} className="text-xs text-primary underline" dir="ltr">
                فتح في تطبيق المصادقة
              </a>
              <form
                id="two-factor-confirm"
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  void run(async () => {
                    const response = await axios.post('/account/two-factor/confirm', { code }, json)
                    setCodes(response.data.data.recoveryCodes)
                    setStep('codes')
                  }, 'رمز التحقق غير صحيح.')
                }}
              >
                <Label htmlFor="enroll-code">رمز التحقق</Label>
                <Input
                  id="enroll-code"
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </form>
            </>
          )}
          {step === 'codes' && (
            <>
              <DialogHeader>
                <DialogTitle>رموز الاسترداد</DialogTitle>
                <DialogDescription>
                  احفظها في مكان آمن؛ كل رمز يُستخدم مرة واحدة إن فقدت هاتفك. لن تظهر مرة أخرى.
                </DialogDescription>
              </DialogHeader>
              <ul dir="ltr" className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-3 font-mono text-sm">
                {codes.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            </>
          )}
          {(step === 'disable' || step === 'regenerate') && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {step === 'disable' ? 'إيقاف التحقق الثنائي' : 'رموز استرداد جديدة'}
                </DialogTitle>
                <DialogDescription>
                  {step === 'disable'
                    ? 'أدخل كلمة المرور ورمزاً حالياً من تطبيق المصادقة أو رمز استرداد.'
                    : 'أدخل رمزاً حالياً من تطبيق المصادقة. ستتوقف الرموز السابقة.'}
                </DialogDescription>
              </DialogHeader>
              <form
                id="two-factor-verify"
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  void run(async () => {
                    if (step === 'disable') {
                      await axios.post('/account/two-factor/disable', { password, code }, json)
                      close()
                    } else {
                      const response = await axios.post(
                        '/account/two-factor/recovery-codes',
                        { code },
                        json
                      )
                      setCodes(response.data.data.recoveryCodes)
                      setCode('')
                      setStep('codes')
                    }
                  }, 'تعذر التحقق.')
                }}
              >
                {step === 'disable' && (
                  <div className="space-y-2">
                    <Label htmlFor="disable-password">كلمة المرور</Label>
                    <Input
                      id="disable-password"
                      type="password"
                      dir="ltr"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="verify-code">رمز التحقق</Label>
                  <Input
                    id="verify-code"
                    dir="ltr"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                  />
                </div>
              </form>
            </>
          )}
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </p>
          )}
          <DialogFooter>
            {step === 'codes' ? (
              <Button type="button" onClick={close}>
                حفظت الرموز
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={close}>
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  form={step === 'enroll' ? 'two-factor-confirm' : 'two-factor-verify'}
                  disabled={busy}
                  variant={step === 'disable' ? 'destructive' : 'default'}
                >
                  {step === 'enroll' ? 'تأكيد التفعيل' : step === 'disable' ? 'إيقاف' : 'إنشاء'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
TwoFactorSettings.layout = (page: ReactElement) => <Workspace>{page}</Workspace>
