import type { ReactElement } from 'react'
import { Head } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { ShieldOff } from 'lucide-react'
import Workspace from '~/layouts/workspace'
import { Button } from '~/components/ui/button'

export default function Forbidden() {
  return (
    <>
      <Head title="غير مصرح" />
      <div className="mx-auto max-w-md py-20 text-center">
        <span className="mx-auto mb-6 grid size-14 place-items-center rounded-full bg-secondary text-primary">
          <ShieldOff size={26} />
        </span>
        <h1 className="text-2xl font-semibold">هذه المنطقة للمديرين فقط</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          حسابك لا يملك صلاحية الإدارة الكاملة. تواصل مع مدير النظام إن كنت تحتاجها.
        </p>
        <Button asChild variant="outline" className="mt-8">
          <Link href="/">العودة إلى الرئيسية</Link>
        </Button>
      </div>
    </>
  )
}
Forbidden.layout = (page: ReactElement) => <Workspace>{page}</Workspace>
