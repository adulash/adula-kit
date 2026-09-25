import { Link } from '@adonisjs/inertia/react'
import { Head, router } from '@inertiajs/react'
import { type InertiaProps } from '~/types'
import { type Data } from '@generated/data'

type Props = InertiaProps<{
  customer: Data.Customer
  can: { update: boolean; delete: boolean }
}>

const dateFormat = new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' })

export default function CustomerShow({ customer, can }: Props) {
  function destroy() {
    if (window.confirm(`هل تريد حذف العميل «${customer.name}»؟`)) {
      router.delete(`/customers/${customer.id}`)
    }
  }

  const empty = <span className="muted">—</span>

  return (
    <div className="page narrow">
      <Head title={customer.name} />
      <div className="page-header">
        <h1>{customer.name}</h1>
        <div className="actions">
          {can.update ? (
            <Link route="customers.edit" routeParams={{ id: customer.id }} className="button">
              تعديل
            </Link>
          ) : null}
          {can.delete ? (
            <button type="button" className="button danger" onClick={destroy}>
              حذف
            </button>
          ) : null}
          <Link route="customers.index" className="button secondary">
            العودة إلى القائمة
          </Link>
        </div>
      </div>
      <dl className="card details">
        <dt>الاسم</dt>
        <dd>{customer.name}</dd>
        <dt>البريد الإلكتروني</dt>
        <dd dir="ltr">{customer.email || empty}</dd>
        <dt>الهاتف</dt>
        <dd dir="ltr">{customer.phone || empty}</dd>
        <dt>العنوان</dt>
        <dd>{customer.address || empty}</dd>
        <dt>تاريخ الإضافة</dt>
        <dd>{customer.createdAt ? dateFormat.format(new Date(customer.createdAt)) : empty}</dd>
        <dt>آخر تعديل</dt>
        <dd>{customer.updatedAt ? dateFormat.format(new Date(customer.updatedAt)) : empty}</dd>
      </dl>
    </div>
  )
}
