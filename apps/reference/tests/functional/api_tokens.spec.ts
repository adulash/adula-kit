import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { seedActor, type UiActor } from '#tests/helpers/ui_fixtures'

const json = { Accept: 'application/json' }
const knex = () => db.connection().getWriteClient()

test.group('Personal API tokens and the resource API', (group) => {
  let owner: UiActor
  let reader: UiActor
  group.setup(async () => {
    owner = await seedActor([{ subject: 'orders', action: 'manage' }], {
      fullName: 'مالك الرمز',
      level: 0,
    })
    reader = await seedActor([{ subject: 'customers', action: 'view' }], {
      fullName: 'قارئ',
      level: 0,
    })
  })

  async function token(client: any, user: UiActor['user'], access: 'read' | 'write') {
    const response = await client
      .post('/account/tokens')
      .loginAs(user)
      .withCsrfToken()
      .headers(json)
      .json({ name: `تكامل ${access}`, access, expiresInDays: 30 })
    response.assertStatus(201)
    return response.body().data as { token: { id: number }; secret: string }
  }

  test('a write token creates and reads records with the owner permissions', async ({
    client,
    assert,
  }) => {
    const { secret } = await token(client, owner.user, 'write')
    assert.match(secret, /^adula_/)
    const stored = await knex()('auth_access_tokens').where('tokenable_id', owner.user.id).first()
    assert.notInclude(stored.hash, secret)

    // No cookies, no CSRF token: bearer authentication only.
    const created = await client
      .post('/api/v1/resources/orders')
      .header('Authorization', `Bearer ${secret}`)
      .header('Accept', '*/*')
      .json({ notes: 'عبر الواجهة البرمجية', orgUnitId: owner.orgUnitId })
    created.assertStatus(201)
    const id = created.body().data.id
    const shown = await client
      .get(`/api/v1/resources/orders/${id}`)
      .header('Authorization', `Bearer ${secret}`)
    shown.assertStatus(200)
    assert.equal(shown.body().data.notes, 'عبر الواجهة البرمجية')
    const forbidden = await client
      .get('/api/v1/resources/customers')
      .header('Authorization', `Bearer ${secret}`)
    forbidden.assertStatus(403)

    const document = await client
      .get('/api/v1/openapi.json')
      .header('Authorization', `Bearer ${secret}`)
    document.assertStatus(200)
    assert.equal(document.body().openapi, '3.1.0')
    assert.property(document.body().paths, '/api/v1/resources/orders')
    assert.notProperty(document.body().paths, '/api/v1/resources/customers')
  })

  test('read tokens cannot write; revoked, invalid and session-only calls are refused', async ({
    client,
    assert,
  }) => {
    const read = await token(client, owner.user, 'read')
    const list = await client
      .get('/api/v1/resources/orders')
      .header('Authorization', `Bearer ${read.secret}`)
    list.assertStatus(200)
    const write = await client
      .post('/api/v1/resources/orders')
      .header('Authorization', `Bearer ${read.secret}`)
      .json({ notes: 'x', orgUnitId: owner.orgUnitId })
    write.assertStatus(403)
    assert.equal(write.body().error.code, 'E_TOKEN_SCOPE')

    const revoked = await client
      .delete(`/account/tokens/${read.token.id}`)
      .loginAs(owner.user)
      .withCsrfToken()
      .headers(json)
    revoked.assertStatus(200)
    const after = await client
      .get('/api/v1/resources/orders')
      .header('Authorization', `Bearer ${read.secret}`)
    after.assertStatus(401)
    const invalid = await client
      .get('/api/v1/resources/orders')
      .header('Authorization', 'Bearer adula_not-a-real-token')
    invalid.assertStatus(401)
    const session = await client.get('/api/v1/resources/orders').loginAs(owner.user).headers(json)
    session.assertStatus(401)
  })

  test('users cannot revoke tokens of others and disabled users lose API access', async ({
    client,
  }) => {
    const mine = await token(client, owner.user, 'read')
    const foreign = await client
      .delete(`/account/tokens/${mine.token.id}`)
      .loginAs(reader.user)
      .withCsrfToken()
      .headers(json)
    foreign.assertStatus(404)
    await knex()('users').where('id', owner.user.id).update({ disabled_at: knex().fn.now() })
    try {
      const response = await client
        .get('/api/v1/resources/orders')
        .header('Authorization', `Bearer ${mine.secret}`)
      response.assertStatus(401)
    } finally {
      await knex()('users').where('id', owner.user.id).update({ disabled_at: null })
    }
  })
})
