import { Form, Link } from '@adonisjs/inertia/react'
import { Head } from '@inertiajs/react'
import { type InertiaProps } from '~/types'
import { type Data } from '@generated/data'
import { CustomerFormFields } from '~/components/customer_form_fields'

type Props = InertiaProps<{ customer: Data.Customer }>

export default function CustomerEdit({ customer }: Props) {
  return (
    <div className="page narrow">
      <Head title={`تعديل ${customer.name}`} />
      <h1>تعديل العميل</h1>
      <Form route="customers.update" routeParams={{ id: customer.id }} className="card form">
        {({ errors, processing }) => (
          <>
            <CustomerFormFields errors={errors} defaults={customer} />
            <div className="actions">
              <button type="submit" className="button" disabled={processing}>
                حفظ التعديلات
              </button>
              <Link
                route="customers.show"
                routeParams={{ id: customer.id }}
                className="button secondary"
              >
                إلغاء
              </Link>
            </div>
          </>
        )}
      </Form>
    </div>
  )
}
