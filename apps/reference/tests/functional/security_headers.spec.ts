import { test } from '@japa/runner'

test.group('Security headers', () => {
  test('pages send a nonce-based CSP and every script tag carries that nonce', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/login')
    response.assertStatus(200)
    const policy = String(response.header('content-security-policy'))
    const nonce = policy.match(/script-src 'self' 'nonce-([^']+)'/)?.[1]
    assert.exists(nonce, policy)
    assert.include(policy, "object-src 'none'")
    assert.include(policy, "frame-ancestors 'none'")
    assert.include(policy, "base-uri 'self'")
    const scripts = response.text().match(/<script\b[^>]*>/g) ?? []
    assert.isAbove(scripts.length, 0)
    for (const tag of scripts) {
      if (/type="application\/json"/.test(tag)) continue
      assert.include(tag, `nonce="${nonce}"`)
    }
    response.assertHeader('x-frame-options', 'DENY')
    response.assertHeader('x-content-type-options', 'nosniff')
  })

  test('the public health probe reports status only', async ({ client, assert }) => {
    const response = await client.get('/health')
    response.assertStatus(200)
    assert.deepEqual(Object.keys(response.body()), ['status'])
    assert.oneOf(response.body().status, ['ok', 'degraded'])
  })
})
