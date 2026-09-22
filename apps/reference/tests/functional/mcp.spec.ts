import { test } from '@japa/runner'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import { kit } from '#services/kit'

test.group('Authenticated MCP resource adapter', (group) => {
  let admin: User
  let restricted: User
  let reader: User
  let orgId: number
  let outsideId: number
  const read = 'adula_resource_read'
  const write = 'adula_resource_write'
  const rpc = (name: string, args: Record<string, unknown>) => ({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name, arguments: args },
  })
  group.setup(async () => {
    admin = await User.create({
      email: 'mcp-admin@example.test',
      password: 'test-only-password-123',
    })
    restricted = await User.create({
      email: 'mcp-denied@example.test',
      password: 'test-only-password-123',
    })
    reader = await User.create({
      email: 'mcp-reader@example.test',
      password: 'test-only-password-123',
    })
    const knex = db.connection().getWriteClient()
    const [org, outside] = await knex('org_units')
      .insert([
        { name: 'نطاق MCP', type: 'root', path: 'mcp_inside' },
        { name: 'نطاق آخر', type: 'root', path: 'mcp_outside' },
      ])
      .returning('id')
    orgId = org.id
    const [adminRole, readerRole] = await knex('roles')
      .insert([
        { name: 'mcp-admin', permission_level: 1 },
        { name: 'mcp-reader', permission_level: 0 },
      ])
      .returning('id')
    await knex('role_rules').insert([
      { role_id: adminRole.id, subject: 'all', action: 'manage' },
      { role_id: readerRole.id, subject: 'orders', action: 'view' },
    ])
    await knex('user_roles').insert([
      { user_id: admin.id, role_id: adminRole.id },
      { user_id: reader.id, role_id: readerRole.id },
    ])
    await knex('user_org_units').insert([
      { user_id: admin.id, org_unit_id: orgId },
      { user_id: admin.id, org_unit_id: outside.id },
      { user_id: reader.id, org_unit_id: orgId },
    ])
    const runtime = kit()
    const actor = await runtime.actors.load(admin.id)
    const outsideRecord = await runtime.resources.save('orders', actor, {
      orgUnitId: outside.id,
      notes: 'private outside MCP',
      total: '777',
    })
    outsideId = Number(outsideRecord.id)
    await runtime.resources.save('orders', actor, {
      orgUnitId: orgId,
      notes: 'MCP visible',
      total: '12345',
    })
  })
  test('requires authentication and CSRF even for protocol discovery', async ({ client }) => {
    const anonymous = await client
      .post('/mcp')
      .withCsrfToken()
      .header('Accept', 'application/json')
      .header('MCP-Session-Id', 'test')
      .json({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    anonymous.assertStatus(401)
    const forgery = await client
      .post('/mcp')
      .loginAs(admin)
      .header('Accept', 'application/json')
      .header('MCP-Session-Id', 'test')
      .json({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    forgery.assertStatus(403)
  })
  test('discovery and reads preserve field filtering and organizational scope', async ({
    client,
    assert,
  }) => {
    const discovery = await client
      .post('/mcp')
      .loginAs(reader)
      .withCsrfToken()
      .header('MCP-Session-Id', 'test')
      .json({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    discovery.assertStatus(200)
    assert.sameMembers(
      discovery.body().result.tools.map((tool: { name: string }) => tool.name),
      [read, write]
    )
    const response = await client
      .post('/mcp')
      .loginAs(reader)
      .withCsrfToken()
      .header('MCP-Session-Id', 'test')
      .json(rpc(read, { resource: 'orders', action: 'list' }))
    response.assertStatus(200)
    const result = JSON.parse(response.body().result.content[0].text)
    assert.lengthOf(result.data, 1)
    assert.equal(result.data[0].notes, 'MCP visible')
    assert.notProperty(result.data[0], 'total')
    const outside = await client
      .post('/mcp')
      .loginAs(reader)
      .withCsrfToken()
      .header('MCP-Session-Id', 'test')
      .json(rpc(read, { resource: 'orders', action: 'show', id: outsideId }))
    assert.isTrue(outside.body().result.isError)
    assert.equal(JSON.parse(outside.body().result.content[0].text).status, 404)
  })
  test('every operation denies a user without roles and cannot accept an actor override', async ({
    client,
    assert,
  }) => {
    for (const [name, action] of [
      [read, 'list'],
      [read, 'show'],
      [read, 'editor'],
      [write, 'create'],
      [write, 'update'],
      [write, 'delete'],
      [write, 'submit'],
      [write, 'cancel'],
    ]) {
      const args = {
        resource: 'orders',
        action,
        ...(action === 'create' || action === 'list' ? {} : { id: outsideId }),
        input: { orgUnitId: orgId, version: 1 },
      }
      const { input, ...readArgs } = args
      const response = await client
        .post('/mcp')
        .loginAs(restricted)
        .withCsrfToken()
        .header('MCP-Session-Id', 'test')
        .json(rpc(name, name === read ? readArgs : args))
      assert.isTrue(response.body().result.isError)
      assert.equal(JSON.parse(response.body().result.content[0].text).status, 403)
    }
    const override = await client
      .post('/mcp')
      .loginAs(restricted)
      .withCsrfToken()
      .header('MCP-Session-Id', 'test')
      .json(rpc(read, { resource: 'orders', action: 'list', actorId: admin.id }))
    assert.equal(JSON.parse(override.body().result.content[0].text).status, 422)
  })
  test('writes share field validation, optimistic conflicts and atomic event records', async ({
    client,
    assert,
  }) => {
    const create = await client
      .post('/mcp')
      .loginAs(admin)
      .withCsrfToken()
      .header('MCP-Session-Id', 'test')
      .json(
        rpc(write, {
          resource: 'orders',
          action: 'create',
          input: { orgUnitId: orgId, notes: 'MCP created', total: '987' },
        })
      )
    const { data } = JSON.parse(create.body().result.content[0].text)
    assert.equal(data.version, 1)
    const denied = await client
      .post('/mcp')
      .loginAs(admin)
      .withCsrfToken()
      .header('MCP-Session-Id', 'test')
      .json(
        rpc(write, {
          resource: 'orders',
          action: 'update',
          id: data.id,
          input: { version: 1, createdBy: reader.id },
        })
      )
    assert.equal(JSON.parse(denied.body().result.content[0].text).status, 422)
    const stale = await client
      .post('/mcp')
      .loginAs(admin)
      .withCsrfToken()
      .header('MCP-Session-Id', 'test')
      .json(
        rpc(write, {
          resource: 'orders',
          action: 'update',
          id: data.id,
          input: { version: 99, notes: 'stale' },
        })
      )
    assert.equal(JSON.parse(stale.body().result.content[0].text).status, 409)
    const submit = await client
      .post('/mcp')
      .loginAs(admin)
      .withCsrfToken()
      .header('MCP-Session-Id', 'test')
      .json(rpc(write, { resource: 'orders', action: 'submit', id: data.id, version: 1 }))
    assert.equal(JSON.parse(submit.body().result.content[0].text).data.docStatus, 1)
    const knex = db.connection().getWriteClient()
    const envelope = await knex('workflow_runs')
      .where({ resource: 'orders', record_id: data.id })
      .first()
    assert.equal(envelope.status, 'pending_definition')
    assert.exists(
      await knex('outbox').where({ id: envelope.id, event: 'orders.orders.submitted' }).first()
    )
    assert.exists(
      await knex('activities')
        .where({ resource: 'orders', record_id: data.id, action: 'submit' })
        .first()
    )
  })
})
