import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from '@japa/runner'
import { ResourceService, htmlToPdf, renderPrintHtml } from '../index.js'
import { admin, db, reader, registry, setup } from './helpers.js'

test.group('Printing', (group) => {
  group.setup(setup)

  test('prints only the fields serialized for the caller, escaped and RTL', async ({ assert }) => {
    const service = new ResourceService(db, registry)
    const saved = await service.save('orders', admin, {
      notes: '<script>alert(1)</script> ملاحظة',
      total: '123456',
      internalNote: 'سري جداً',
      orgUnitId: 2,
    })
    const render = async (actor: typeof admin) => {
      const shown = await service.show('orders', Number(saved.id), actor)
      return renderPrintHtml({
        identity: { name: 'شركة الاختبار' },
        resource: service.describe('orders', actor),
        record: shown.data,
        related: shown.related,
        printedBy: 'المختبر',
        printedAt: new Date('2026-09-25T10:00:00Z'),
      })
    }
    const full = await render(admin)
    assert.include(full, '<html lang="ar" dir="rtl">')
    assert.include(full, '&lt;script&gt;alert(1)&lt;/script&gt; ملاحظة')
    assert.notInclude(full, '<script>')
    assert.include(full, 'سري جداً')
    assert.include(full, `${new Intl.NumberFormat('ar-u-nu-latn').format(1234)}.56`)
    assert.include(full, 'مسودة')
    const limited = await render(reader)
    assert.notInclude(limited, 'سري جداً')
    assert.notInclude(limited, 'الإجمالي')
  })

  test('converts through a Gotenberg-compatible service and rejects non-PDF output', async ({
    assert,
  }) => {
    let valid = true
    let received = ''
    const server = createServer((request, response) => {
      let body = ''
      request.on('data', (chunk) => (body += chunk))
      request.on('end', () => {
        received = `${request.method} ${request.url} ${body.includes('index.html')}`
        response.writeHead(200).end(valid ? '%PDF-1.7 fake' : '<html>error</html>')
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
      const pdf = await htmlToPdf('<html dir="rtl"></html>', { gotenbergUrl: url })
      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
      assert.equal(received, 'POST /forms/chromium/convert/html true')
      valid = false
      await assert.rejects(() => htmlToPdf('<html></html>', { gotenbergUrl: url }), /non-PDF/)
    } finally {
      server.close()
    }
  })
})
