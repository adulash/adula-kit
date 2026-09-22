import { usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { Bell } from 'lucide-react'

export function NotificationBell() {
  const page = usePage<{ unreadNotifications?: number; user?: { email: string } }>()
  if (!page.props.user) return null
  const count = page.props.unreadNotifications ?? 0
  return (
    <Link
      href="/notifications"
      aria-label={count ? `الإشعارات، ${count} غير مقروء` : 'الإشعارات'}
      className="relative grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
    >
      <Bell size={18} strokeWidth={1.6} />
      {count > 0 && (
        <span
          data-testid="unread-count"
          className="absolute -end-0.5 -top-0.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-semibold leading-4 text-white"
        >
          {count}
        </span>
      )}
    </Link>
  )
}
