import { useEffect, useRef, useState, type ReactNode } from 'react'
import { router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'

export type ResourcePresentation = 'dialog' | 'page'

const LIST_RETURN = 'adula:list-return'
type ListReturn = { href: string; scroll: number; record: string }

/**
 * Remembers the list view (query and scroll) before a record opens from it, so closing the
 * record dialog returns to that view. DataTable calls it; page overrides that link to records
 * from their own list can call it too.
 */
export function rememberListView(record: string) {
  try {
    sessionStorage.setItem(
      LIST_RETURN,
      JSON.stringify({
        href: window.location.pathname + window.location.search,
        scroll: window.scrollY,
        record,
      } satisfies ListReturn)
    )
  } catch {
    // Storage can be unavailable (private mode); closing then falls back to backHref.
  }
}

function listReturn(backHref: string): ListReturn | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(LIST_RETURN) ?? 'null') as ListReturn | null
    const path = (href: string) => new URL(href, window.location.origin).pathname
    if (saved && typeof saved.href === 'string' && path(saved.href) === path(backHref)) return saved
  } catch {
    // Ignore unreadable entries.
  }
  return null
}

/** Return focus to the control that opened the record, else to the page heading without a ring. */
function restoreFocus(record: string | undefined) {
  const trigger = record
    ? document.querySelector<HTMLElement>(`main a[href="${CSS.escape(record)}"]`)
    : null
  const target = trigger ?? document.querySelector<HTMLElement>('main h1')
  if (!trigger && target) {
    target.setAttribute('tabindex', '-1')
    target.classList.add('outline-none')
  }
  target?.focus({ preventScroll: true })
}

/** Forms and record details are modal unless the user requests a page override. */
export function ResourceSurface({
  title,
  description,
  backHref,
  presentation = 'dialog',
  mode,
  children,
}: {
  title: string
  description: string
  backHref: string
  presentation?: ResourcePresentation
  mode?: 'view' | 'edit'
  children: ReactNode
}) {
  const [open, setOpen] = useState(true)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(closeTimer.current), [])
  if (presentation === 'page')
    return (
      <section dir="rtl" className="space-y-6">
        <Button variant="outline" asChild>
          <Link href={backHref}>العودة إلى القائمة</Link>
        </Button>
        <header>
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{description}</p>
        </header>
        {children}
      </section>
    )

  return (
    <Dialog
      mode={mode}
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          setOpen(false)
          closeTimer.current = setTimeout(
            () => {
              // Return to the list view the record was opened from: same query and scroll.
              const saved = listReturn(backHref)
              router.visit(saved?.href ?? backHref, {
                onSuccess: () => {
                  if (saved) window.scrollTo(0, saved.scroll)
                  // A direct route has no mounted DialogTrigger to restore focus to.
                  restoreFocus(saved?.record)
                },
              })
            },
            window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160
          )
        }
      }}
    >
      <DialogContent
        dir="rtl"
        className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        <DialogHeader className="shrink-0 border-b px-6 py-5 pe-12 text-start">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">{children}</div>
      </DialogContent>
    </Dialog>
  )
}
