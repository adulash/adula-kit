import { useEffect } from 'react'
import { router, usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { Transmit } from '@adonisjs/transmit-client'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'

const HIDDEN_GRACE_MS = 10_000
let client: Transmit | undefined
function realtime() {
  // One Transmit client per tab, used by the leader tab only. Subscriptions are POSTs, so they carry the CSRF token.
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

/**
 * Opens this tab's subscription to the user's notification channel; returns a closer.
 * Each open stream holds one of the browser's six HTTP/1.1 connections to this host.
 */
function openStream(userId: number, onMessage: () => void) {
  const transmit = realtime()
  const subscription = transmit.subscription(`notifications/${userId}`)
  let active = true
  subscription
    .create()
    .then(() => {
      if (!active) void subscription.delete()
    })
    .catch(() => {})
  const stop = subscription.onMessage(onMessage)
  return () => {
    active = false
    stop()
    void subscription.delete().catch(() => {})
    client?.close()
    client = undefined
  }
}

/**
 * One stream per browser, not per tab (#36): visible tabs elect a leader with a Web Lock;
 * the leader holds the stream and relays each signal to the other tabs over a
 * BroadcastChannel. When the leader closes or is hidden, a waiting tab takes over.
 * Browsers without these APIs fall back to a stream per visible tab.
 */
function joinRealtime(userId: number, onMessage: () => void) {
  const name = `adula:notifications:${userId}`
  if (typeof BroadcastChannel === 'undefined' || !('locks' in navigator)) {
    return openStream(userId, onMessage)
  }
  const channel = new BroadcastChannel(name)
  channel.onmessage = () => onMessage()
  const leave = new AbortController()
  navigator.locks
    .request(name, { signal: leave.signal }, async () => {
      const stop = openStream(userId, () => {
        onMessage()
        channel.postMessage('notification')
      })
      // Hold the lock, and the stream, until this tab leaves.
      await new Promise<void>((resolve) =>
        leave.signal.addEventListener('abort', () => resolve(), { once: true })
      )
      stop()
    })
    .catch(() => {
      // Leaving before becoming the leader aborts the pending request.
    })
  return () => {
    leave.abort()
    channel.close()
  }
}

export function NotificationBell() {
  const page = usePage<{
    unreadNotifications?: number
    user?: { id: number; email: string }
  }>()
  const userId = page.props.user?.id
  useEffect(() => {
    if (!userId) return
    let leaveRealtime: (() => void) | undefined
    const onMessage = () => {
      router.reload({ only: ['unreadNotifications'] })
      toast('وصلك إشعار جديد', {
        action: { label: 'عرض', onClick: () => router.visit('/notifications') },
      })
    }
    const open = () => {
      leaveRealtime ??= joinRealtime(userId, onMessage)
    }
    const close = () => {
      leaveRealtime?.()
      leaveRealtime = undefined
    }
    let hiddenTimer: ReturnType<typeof setTimeout> | undefined
    const onVisibility = () => {
      clearTimeout(hiddenTimer)
      if (document.visibilityState === 'hidden') {
        // A short grace period avoids handing the stream over on every quick tab switch.
        hiddenTimer = setTimeout(close, HIDDEN_GRACE_MS)
      } else if (!leaveRealtime) {
        open()
        // Catch up on notifications that arrived while this tab was not listening.
        router.reload({ only: ['unreadNotifications'] })
      }
    }
    if (document.visibilityState !== 'hidden') open()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearTimeout(hiddenTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      close()
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
