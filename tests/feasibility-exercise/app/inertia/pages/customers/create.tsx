import { Form, Link } from '@adonisjs/inertia/react'
import { Head } from '@inertiajs/react'
import { CustomerFormFields } from '~/components/customer_form_fields'

export default function CustomerCreate() {
  return (
    <div className="page narrow">
      <Head title="إضافة عميل" />
      <h1>إضافة عميل</h1>
      <Form route="customers.store" className="card form">
        {({ errors, processing }) => (
          <>
            <CustomerFormFields errors={errors} />
            <div className="actions">
              <button type="submit" className="button" disabled={processing}>
                حفظ
              </button>
              <Link route="customers.index" className="button secondary">
                إلغاء
              </Link>
            </div>
          </>
        )}
      </Form>
    </div>
  )
}
