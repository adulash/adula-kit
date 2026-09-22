import { Head, usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import type { ResourceNavigation } from '@adula/kit'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import Workspace from '~/layouts/workspace'
import Layout from '~/layouts/default'

export default function Home() {
  const { user, isAdmin, navigation } = usePage<{
    user?: { email: string }
    isAdmin: boolean
    navigation: ResourceNavigation
  }>().props
  return (
    <>
      <Head title="مساحة العمل · adula kit" />
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-12" dir="rtl">
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 className="text-3xl">مساحة العمل</h1>
            </CardTitle>
            <CardDescription>وحدات أعمالك وإعدادات حسابك في مكان واحد.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {user ? (
              <>
                <Button asChild>
                  <Link href="/account/profile">حسابي</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/notifications">الإشعارات</Link>
                </Button>
                {isAdmin && (
                  <Button asChild variant="outline">
                    <Link href="/admin/setup">بدء الإعداد الأولي</Link>
                  </Button>
                )}
                {isAdmin && (
                  <Button asChild variant="outline">
                    <Link href="/admin/users">إدارة النظام</Link>
                  </Button>
                )}
              </>
            ) : (
              <Button asChild>
                <Link href="/login">تسجيل الدخول</Link>
              </Button>
            )}
          </CardContent>
        </Card>
        {(navigation ?? []).length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {navigation.map((entry) => (
              <Card key={entry.href}>
                <CardHeader>
                  <CardTitle>{entry.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <Link href={entry.href}>فتح {entry.label}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">ستظهر هنا وحدات العمل المتاحة لحسابك.</p>
        )}
      </div>
    </>
  )
}

Home.layout = (props: { user?: unknown }) => (props.user ? Workspace : Layout)
