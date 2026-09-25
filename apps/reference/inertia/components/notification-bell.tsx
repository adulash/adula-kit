import { useEffect } from 'react'
import { router, usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { Transmit } from '@adonisjs/transmit-client'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'

let client: Transmit | undefined
function realtime() {
  // One shared stream per tab. Subscriptions are POSTs, so they carry the CSRF token.
  client ??= new Transmit({
    baseUrl: window.location.origin,
    beforeSubscribe: (request) => {
      const token = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)?.[1]
      if (token) request.headers.set('X-XSRF-TOKEN', decodeURIComponent(token))
    },
    beforeUnsubscribe: (request) => {
      const token = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)?.[1]
      if (token) request.headers.set('X-XSRF-TOKEN', decodeURIComponent(token))
    },
  })
  return client
}

export function NotificationBell() {
  const page = usePage<{
    unreadNotifications?: number
    user?: { id: number; email: string }
  }>()
  const userId = page.props.user?.id
  useEffect(() => {
    if (!userId) return
    const subscription = realtime().subscription(`notifications/${userId}`)
    let active = true
    subscription
      .create()
      .then(() => {
        if (!active) void subscription.delete()
      })
      .catch(() => {})
    const stop = subscription.onMessage(() => {
      router.reload({ only: ['unreadNotifications'] })
      toast('وصلك إشعار جديد', {
        action: { label: 'عرض', onClick: () => router.visit('/notifications') },
      })
    })
    return () => {
      active = false
      stop()
      void subscription.delete().catch(() => {})
    }
  }, [userId])
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
