import { Head } from '@inertiajs/react'
import { Form, Link } from '@adonisjs/inertia/react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'

export default function TwoFactorChallenge() {
  return (
    <>
      <Head title="التحقق الثنائي" />
      <div dir="rtl" className="mx-auto w-full max-w-md py-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">التحقق الثنائي</CardTitle>
            <CardDescription>
              أدخل الرمز المكوّن من ستة أرقام من تطبيق المصادقة، أو أحد رموز الاسترداد.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form route="two_factor_challenge.store" className="space-y-5">
              {({ errors: validation, processing }) => {
                // The challenge validates in the controller; errors arrive in the flash bag.
                const errors = validation as { code?: string }
                return (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="code">رمز التحقق</Label>
                      <Input
                        id="code"
                        name="code"
                        dir="ltr"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoFocus
                        required
                        maxLength={32}
                        aria-invalid={errors.code ? true : undefined}
                      />
                      {errors.code && (
                        <p className="text-sm text-destructive" role="alert">
                          {errors.code}
                        </p>
                      )}
                    </div>
                    <Button type="submit" className="w-full" disabled={processing}>
                      تحقق ودخول
                    </Button>
                    <Link
                      route="session.create"
                      className="block text-center text-xs text-muted-foreground hover:text-foreground"
                    >
                      العودة إلى تسجيل الدخول
                    </Link>
                  </>
                )
              }}
            </Form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
