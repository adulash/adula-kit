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
              router.visit(backHref, {
                onSuccess: () => {
                  // A direct route has no mounted DialogTrigger to restore focus to.
                  const heading = document.querySelector<HTMLElement>('main h1')
                  heading?.setAttribute('tabindex', '-1')
                  heading?.focus()
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
