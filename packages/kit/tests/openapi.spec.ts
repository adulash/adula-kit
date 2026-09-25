import { test } from '@japa/runner'
import { openApiDocument } from '../index.js'
import { admin, reader, registry } from './helpers.js'

test.group('OpenAPI document', () => {
  test('describes every top-level resource with read and input schemas', ({ assert }) => {
    const document = openApiDocument(registry, {
      title: 'Test',
      version: '1.0.0',
      serverUrl: 'https://example.test',
      actor: admin,
    })
    assert.equal(document.openapi, '3.1.0')
    const paths = Object.keys(document.paths)
    assert.includeMembers(paths, [
      '/api/v1/resources/orders',
      '/api/v1/resources/orders/{id}',
      '/api/v1/resources/orders/{id}/submit',
      '/api/v1/resources/customers',
    ])
    // Inline children are written through their parent only.
    assert.notInclude(paths, '/api/v1/resources/order_lines')
    const input = document.components.schemas.orders_input as {
      properties: Record<string, { type?: unknown }>
      required: string[]
    }
    assert.notProperty(input.properties, 'number')
    assert.property(input.properties, 'lines')
    assert.include(input.required, 'orgUnitId')
    const read = document.components.schemas.orders as { properties: Record<string, unknown> }
    assert.property(read.properties, 'docStatus')
    assert.notProperty(read.properties, 'lines')
  })

  test('limits operations to what the actor may do', ({ assert }) => {
    const document = openApiDocument(registry, {
      title: 'Test',
      version: '1.0.0',
      serverUrl: 'https://example.test',
      actor: reader,
    })
    const customers = document.paths['/api/v1/resources/customers'] as Record<string, unknown>
    assert.properties(customers, ['get'])
    assert.notProperty(customers, 'post')
    assert.notProperty(document.paths, '/api/v1/resources/orders/{id}/cancel')
    assert.property(document.paths, '/api/v1/resources/orders/{id}/submit')
  })
})
