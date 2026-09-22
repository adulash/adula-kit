import type { ReactNode } from 'react'
import { usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { ClipboardList, LayoutDashboard, ArrowUpLeft } from 'lucide-react'
import type { ResourceNavigation } from '@adula/kit'
import { Toaster } from '~/components/ui/sonner'
import { AccountMenu } from '~/components/account-menu'
import { AdminNav, ImpersonationBar, adminLinks } from '~/components/admin-nav'
import { FlashMessages } from '~/components/flash-messages'
import { useUiPreferences } from '~/components/ui/ui-preferences'
import { BackupBanner } from '~/components/backup-banner'
import { NotificationBell } from '~/components/notification-bell'

export default function Workspace({ children }: { children: ReactNode }) {
  const preferences = useUiPreferences()
  const page = usePage<{
    user?: { fullName: string | null; email: string }
    navigation: ResourceNavigation
    canInviteUsers?: boolean
  }>()
  const navigation = [
    { href: '/', label: 'نظرة عامة', icon: LayoutDashboard },
    ...(page.props.canInviteUsers
      ? [{ href: '/users/invite', label: 'دعوة مستخدم', icon: ClipboardList }]
      : []),
    ...(page.props.navigation ?? []).map((entry) => ({ ...entry, icon: ClipboardList })),
  ]
  const current =
    [...navigation, ...adminLinks].find(
      (entry) => entry.href !== '/' && page.url.startsWith(entry.href)
    )?.label ?? 'نظرة عامة'
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground" data-workspace-shell>
      <FlashMessages />
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-[244px] flex-col overflow-y-auto border-e border-border bg-white lg:flex [&>*]:shrink-0">
        <Link href="/" className="flex h-24 items-center gap-3 px-7">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-2xl font-bold text-white">
            ع
          </span>
          <span>
            <strong className="block text-xl tracking-tight">عدولة</strong>
            <span className="text-[11px] text-muted-foreground">مساحة أعمالك، بوضوح</span>
          </span>
        </Link>
        <div className="mx-5 mb-8 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium">
          مساحة العمل
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            التطبيق المرجعي
          </span>
        </div>
        <p className="mb-3 px-7 text-[11px] font-semibold text-muted-foreground">العمل اليومي</p>
        <nav aria-label="التنقل الرئيسي" className="space-y-1 px-4">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = href !== '/' ? page.url.startsWith(href) : page.url === '/'
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors ${active ? 'bg-accent font-semibold text-primary' : 'text-muted-foreground hover:bg-background hover:text-foreground'}`}
              >
                <Icon size={19} strokeWidth={1.6} />
                {label}
              </Link>
            )
          })}
        </nav>
        <AdminNav />
        <div className="mx-5 mb-6 mt-auto border-t border-border pt-5">
          <AccountMenu />
          <Link
            href="/"
            className="mt-4 flex items-center justify-between text-xs text-muted-foreground"
          >
            الصفحة الرئيسية
            <ArrowUpLeft size={14} />
          </Link>
        </div>
      </aside>
      <div className="lg:ps-[244px]">
        <div className="flex h-[72px] items-center justify-between border-b border-border bg-white/80 px-5 lg:px-10">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground lg:hidden">عدولة</span>
            <span>مساحة العمل</span>
            <span>/</span>
            <span className="text-foreground">{current}</span>
          </div>
          <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <NotificationBell />
            <span className="size-1.5 rounded-full bg-primary" />
            بيئة التجربة
          </span>
        </div>
        <BackupBanner />
        <ImpersonationBar />
        <nav
          aria-label="التنقل على الجوال"
          className="flex gap-5 overflow-auto border-b border-border bg-white px-5 py-3 text-xs lg:hidden"
        >
          {navigation.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="mx-auto max-w-[1440px] p-5 lg:px-10 lg:py-9">
          <div
            key={page.url.split('?')[0]}
            className={preferences.pageTransitions ? 'adula-page-enter' : undefined}
          >
            {children}
          </div>
        </main>
      </div>
      <Toaster position="bottom-left" richColors />
    </div>
  )
}
