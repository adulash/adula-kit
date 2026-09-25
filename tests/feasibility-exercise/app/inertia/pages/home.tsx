import { Link } from '@adonisjs/inertia/react'
import { usePage } from '@inertiajs/react'

export default function Home() {
  const { user } = usePage().props
  return (
    <div className="hero">
      <h1>نظام إدارة العملاء</h1>
      {user ? (
        <p>
          <Link route="customers.index" className="button">
            الانتقال إلى العملاء
          </Link>
        </p>
      ) : (
        <p>
          <Link route="session.create" className="button">
            تسجيل الدخول
          </Link>
        </p>
      )}
    </div>
  )
}
