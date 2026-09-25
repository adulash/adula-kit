import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import router from '@adonisjs/core/services/router'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'

/** Public, guest-only or file-download routes are the only ones outside this scan. */
const SKIPPED = [
  /^\/$/,
  /^\/health$/,
  /^\/mcp(\/|$)/,
  /^\/(login|signup|logout)$/,
  /^\/login\/two-factor$/,
  /^\/password\//,
  /^\/invitations\//,
  /^\/oauth\//,
  /^\/attachments\/:id$/,
  /download/,
]
const PLACEHOLDERS: Record<string, string> = {
  resource: 'orders',
  field: 'customerId',
  provider: 'github',
  token: 'scan-token',
}
type Verb = 'get' | 'post' | 'put' | 'patch' | 'delete'
const fill = (pattern: string) =>
  pattern.replace(/:(\w+)\??/g, (_, name: string) => PLACEHOLDERS[name] ?? '999999')

test.group('Registered route scan', (group) => {
  let admin: User
  let plain: User
  const unique = randomUUID().replaceAll('-', '').slice(0, 10)
  const routes = () =>
    Object.values(router.toJSON())
      .flat()
      .filter((route) => !SKIPPED.some((pattern) => pattern.test(route.pattern)))
      .flatMap((route) =>
        route.methods
          .filter((method) => method !== 'HEAD')
          .map((method) => ({ verb: method.toLowerCase() as Verb, pattern: route.pattern }))
      )

  group.setup(async () => {
    const knex = db.connection().getWriteClient()
    admin = await User.create({
      fullName: 'مدير المسح',
      email: `scan-admin-${unique}@example.test`,
      password: 'test-only-password-123',
    })
    plain = await User.create({
      fullName: 'بلا أدوار',
      email: `scan-plain-${unique}@example.test`,
      password: 'test-only-password-123',
    })
    const [org] = await knex('org_units')
      .insert({ name: 'وحدة المسح', type: 'root', path: `scan${unique}` })
      .returning('id')
    const [role] = await knex('roles')
      .insert({ name: `scan-admin-${unique}`, permission_level: 1 })
      .returning('id')
    await knex('role_rules').insert({ role_id: role.id, subject: 'all', action: 'manage' })
    await knex('user_roles').insert({ user_id: admin.id, role_id: role.id })
    await knex('user_org_units').insert({ user_id: admin.id, org_unit_id: org.id })
  })

  test('the scan covers the registered routes', ({ assert }) => {
    const scanned = routes()
    assert.isAbove(scanned.length, 40)
    assert.exists(scanned.find((route) => route.pattern === '/admin/roles/:id/rules'))
    assert.exists(scanned.find((route) => route.pattern === '/resources/:resource'))
  })

  test('anonymous clients never reach a protected route', async ({ client, assert }) => {
    for (const { verb, pattern } of routes()) {
      const response = await client[verb](fill(pattern))
        .withCsrfToken()
        .header('Accept', 'application/json')
      assert.oneOf(
        response.status(),
        [401, 302, 404],
        `${verb.toUpperCase()} ${pattern} answered ${response.status()} anonymously`
      )
    }
  })

  test('a signed-in user without roles is refused on admin and resource routes', async ({
    client,
    assert,
  }) => {
    for (const { verb, pattern } of routes()) {
      const response = await client[verb](fill(pattern))
        .loginAs(plain)
        .withCsrfToken()
        .header('Accept', 'application/json')
      const protectedArea =
        pattern.startsWith('/admin') ||
        pattern.startsWith('/resources') ||
        pattern === '/users/invite'
      if (protectedArea)
        assert.oneOf(
          response.status(),
          [403, 404],
          `${verb.toUpperCase()} ${pattern} answered ${response.status()} without roles`
        )
      else
        assert.isBelow(
          response.status(),
          500,
          `${verb.toUpperCase()} ${pattern} failed with ${response.status()}`
        )
    }
  })

  test('the administrator opens every GET route without 403 or 500', async ({ client, assert }) => {
    for (const { pattern } of routes().filter((route) => route.verb === 'get')) {
      const response = await client
        .get(fill(pattern))
        .loginAs(admin)
        .header('Accept', 'text/html')
        .withInertia()
      assert.notInclude(
        [403, 500],
        response.status(),
        `GET ${pattern} answered ${response.status()} for the administrator`
      )
      assert.isBelow(response.status(), 500, `GET ${pattern} failed with ${response.status()}`)
    }
  })
})
