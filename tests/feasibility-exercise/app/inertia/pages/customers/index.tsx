import { Link } from '@adonisjs/inertia/react'
import { Head, router } from '@inertiajs/react'
import { type FormEvent, useState } from 'react'
import { type InertiaProps } from '~/types'
import { type Data } from '@generated/data'

type SortKey = 'name' | 'email' | 'phone' | 'created_at'
type Filters = { search: string; sort: SortKey; order: 'asc' | 'desc' }

type Props = InertiaProps<{
  customers: { data: Data.Customer[]; metadata: Record<string, any> }
  filters: Filters
  can: { create: boolean }
}>

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'الاسم' },
  { key: 'email', label: 'البريد الإلكتروني' },
  { key: 'phone', label: 'الهاتف' },
  { key: 'created_at', label: 'تاريخ الإضافة' },
]

const dateFormat = new Intl.DateTimeFormat('ar', { dateStyle: 'medium' })

function visit(filters: Filters, page?: number) {
  const query: Record<string, string | number> = { sort: filters.sort, order: filters.order }
  if (filters.search) query.search = filters.search
  if (page && page > 1) query.page = page
  router.get('/customers', query, { preserveState: true, replace: true })
}

export default function CustomersIndex({ customers, filters, can }: Props) {
  const [search, setSearch] = useState(filters.search)
  const meta = customers.metadata
  const currentPage = Number(meta.currentPage ?? 1)
  const lastPage = Number(meta.lastPage ?? 1)

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    visit({ ...filters, search })
  }

  function toggleSort(key: SortKey) {
    const order = filters.sort === key && filters.order === 'asc' ? 'desc' : 'asc'
    visit({ ...filters, sort: key, order })
  }

  return (
    <div className="page">
      <Head title="العملاء" />
      <div className="page-header">
        <h1>العملاء</h1>
        {can.create ? (
          <Link route="customers.create" className="button">
            إضافة عميل
          </Link>
        ) : null}
      </div>

      <form role="search" className="toolbar" onSubmit={submitSearch}>
        <label htmlFor="search" className="visually-hidden">
          بحث
        </label>
        <input
          id="search"
          type="search"
          placeholder="ابحث بالاسم أو البريد أو الهاتف"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit" className="button secondary">
          بحث
        </button>
      </form>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              {COLUMNS.map((column) => {
                const active = filters.sort === column.key
                const ariaSort = active
                  ? filters.order === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
                return (
                  <th key={column.key} aria-sort={ariaSort} scope="col">
                    <button type="button" className="sort" onClick={() => toggleSort(column.key)}>
                      {column.label}
                      <span aria-hidden="true">
                        {active ? (filters.order === 'asc' ? ' ▲' : ' ▼') : ''}
                      </span>
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {customers.data.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="empty">
                  {filters.search ? 'لا توجد نتائج مطابقة للبحث' : 'لا يوجد عملاء بعد'}
                </td>
              </tr>
            ) : (
              customers.data.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <Link route="customers.show" routeParams={{ id: customer.id }} className="link">
                      {customer.name}
                    </Link>
                  </td>
                  <td dir="ltr">{customer.email ?? '—'}</td>
                  <td dir="ltr">{customer.phone ?? '—'}</td>
                  <td>
                    {customer.createdAt ? dateFormat.format(new Date(customer.createdAt)) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {lastPage > 1 ? (
        <nav className="pagination" aria-label="الصفحات">
          <button
            type="button"
            className="button secondary"
            disabled={currentPage <= 1}
            onClick={() => visit(filters, currentPage - 1)}
          >
            السابق
          </button>
          <span>
            صفحة {currentPage} من {lastPage}
          </span>
          <button
            type="button"
            className="button secondary"
            disabled={currentPage >= lastPage}
            onClick={() => visit(filters, currentPage + 1)}
          >
            التالي
          </button>
        </nav>
      ) : null}
    </div>
  )
}
