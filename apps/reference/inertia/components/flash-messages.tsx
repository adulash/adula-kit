import { useEffect } from 'react'
import { usePage } from '@inertiajs/react'
import { toast } from 'sonner'

export function FlashMessages() {
  const { flash } = usePage()
  useEffect(() => {
    const inline = [...document.querySelectorAll('[data-flash-message]')].map((element) =>
      element.getAttribute('data-flash-message')
    )
    if (typeof flash.error === 'string' && !inline.includes(flash.error))
      toast.error(flash.error, { id: 'flash-error' })
    if (typeof flash.success === 'string' && !inline.includes(flash.success))
      toast.success(flash.success, { id: 'flash-success' })
  }, [flash])
  return null
}
