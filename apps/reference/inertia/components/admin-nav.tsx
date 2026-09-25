import type { ReactNode } from 'react'
import { router, usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import {
  Activity,
  History,
  KeyRound,
  Network,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  Mail,
  Webhook,
} from 'lucide-react'
import { calendarDisplay } from '~/components/ui/calendar_date'
import { useUiPreferences } from '~/components/ui/ui-preferences'
import { Button } from '~/components/ui/button'

export const adminLinks = [
  { href: '/admin/setup', label: 'الإعداد الأولي', icon: Settings },
  { href: '/admin/users', label: 'المستخدمون', icon: Users },
  { href: '/admin/roles', label: 'الأدوار والصلاحيات', icon: ShieldCheck },
  { href: '/admin/org-units', label: 'الهيكل التنظيمي', icon: Network },
  { href: '/admin/activity', label: 'سجل النشاط', icon: History },
  { href: '/admin/jobs', label: 'تشغيل النظام', icon: Activity },
  { href: '/admin/settings', label: 'الإعدادات', icon: Settings },
  { href: '/admin/templates', label: 'قوالب الرسائل', icon: Mail },
  { href: '/admin/webhooks', label: 'الربط الخارجي', icon: Webhook },
  { href: '/admin/sessions', label: 'الجلسات', icon: KeyRound },
]

export function AdminNav() {
  const page = usePage<{ isAdmin?: boolean }>()
  if (!page.props.isAdmin) return null
  return (
    <>
      <p className="mb-3 mt-8 px-7 text-[11px] font-semibold text-muted-foreground">الإدارة</p>
      <nav aria-label="التنقل الإداري" className="space-y-1 px-4">
        {adminLinks.map(({ href, label, icon: Icon }) => {
          const active = page.url.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-colors ${active ? 'bg-accent font-semibold text-primary' : 'text-muted-foreground hover:bg-background hover:text-foreground'}`}
            >
              <Icon size={17} strokeWidth={1.6} />
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}

export function ImpersonationBar() {
  const page = usePage<{
    impersonating?: boolean
    user?: { fullName: string | null; email: string }
  }>()
  if (!page.props.impersonating) return null
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-5 py-2 text-sm text-amber-900 lg:px-10"
    >
      <span className="flex items-center gap-2">
        <UserCog size={16} />
        أنت تتصفح باسم {page.props.user?.fullName || page.props.user?.email}
      </span>
      <Button size="sm" variant="outline" onClick={() => router.post('/impersonation/stop')}>
        إنهاء الانتحال
      </Button>
    </div>
  )
}

export function AdminHeader({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck size={15} />
          <span>الإدارة</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-3 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2 pt-3">{children}</div>}
    </div>
  )
}

export function useDateTimeFormatter() {
  const { calendar } = useUiPreferences()
  return (value: string | null | undefined) => calendarDisplay(value, calendar, true)
}

export function formatAge(ms: number | null) {
  if (ms === null) return 'لا يوجد'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `قبل ${seconds} ثانية`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `قبل ${minutes} دقيقة`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `قبل ${hours} ساعة`
  return `قبل ${Math.round(hours / 24)} يوماً`
}
