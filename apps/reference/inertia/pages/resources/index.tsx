import { Head } from '@inertiajs/react'
import type { SerializedRecord } from '@adula/kit/types'
type Props = {
  label: string
  name: string
  result: { data: SerializedRecord[]; meta: { nextCursor: string | null; limit: number } }
}
export default function ResourceIndex({ label, name, result }: Props) {
  return (
    <main dir="rtl" style={{ maxWidth: 1000, margin: '60px auto', padding: 24 }}>
      <Head title={label} />
      <a href="/">العودة للرئيسية</a>
      <h1>{label}</h1>
      <p>واجهة فحص النواة · واجهة إدارة الموارد الكاملة ضمن المرحلة الثانية.</p>
      {result.data.length ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {Object.keys(result.data[0]).map((key) => (
                <th key={key} style={{ textAlign: 'right', padding: 12 }}>
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.data.map((row) => (
              <tr key={String(row.id)}>
                {Object.keys(result.data[0]).map((key) => (
                  <td key={key} style={{ padding: 12, borderTop: '1px solid #ddd' }}>
                    {String(row[key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>لا توجد سجلات متاحة ضمن صلاحياتك.</p>
      )}
      {result.meta.nextCursor && (
        <a href={`/resources/${name}?cursor=${encodeURIComponent(result.meta.nextCursor)}`}>
          الصفحة التالية ←
        </a>
      )}
    </main>
  )
}
