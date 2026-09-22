// Harness contract tests only. Real PostgreSQL/HTTP suites remain the authorization authority.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createWorkload, validateFixture, validList } from '../../apps/reference/tests/perf/workload.mjs'

const fixture = () => ({
  baseUrl: 'http://127.0.0.1:3334', isolated: true, resource: 'assets',
  runId: 'contract', uniqueField: 'name', relationFields: ['locationId', 'categoryId'],
  users: [1, 2].map((id) => ({ email: `load-${id}@example.test`, password: 'test-only', saveBody: { orgUnitId: id } })),
})
const response = (status, body) => ({ status, json: () => body, timings: { duration: 20 } })
const list = () => response(200, {
  data: [{ id: 5, locationId: 1, categoryId: 2 }],
  related: { locationId: [{ id: 1 }], categoryId: [{ id: 2 }] },
})

test('workload refuses shared credentials, missing users, production consent and removed resources', () => {
  validateFixture(fixture(), 2)
  const duplicate = fixture()
  duplicate.users[1].email = ' LOAD-1@EXAMPLE.TEST '
  assert.throws(() => validateFixture(duplicate, 2), /Shared user/)
  assert.throws(() => validateFixture(fixture(), 50), /distinct authorized user/)
  assert.throws(() => validateFixture({ ...fixture(), isolated: false }, 2), /isolated/)
  assert.throws(() => validateFixture({ ...fixture(), resource: 'orders' }, 2), /independent/)
  assert.throws(() => validateFixture({ ...fixture(), relationFields: ['locationId', 'locationId'] }, 2), /distinct belongsTo/)
  assert.throws(() => validateFixture(fixture(), 0), /VUS/)
})

test('list sampling requires nonempty records and both correctly linked preloads', () => {
  assert.equal(validList(list(), fixture().relationFields), true)
  for (const invalid of [response(302, {}), response(200, { data: [] }), response(200, { data: [{ locationId: 9, categoryId: 2 }], related: list().json().related }), { status: 200, json() { throw new Error('HTML') } }])
    assert.equal(validList(invalid, fixture().relationFields), false)
})

function harness({ listResponse = list(), saveStatus = 201 } = {}) {
  const calls = [], samples = { list: [], save: [], lists: [], saves: [] }
  const metric = (name) => ({ add: (value) => samples[name].push(value) })
  const run = createWorkload(fixture(), {
    http: {
      cookieJar: () => ({ cookiesForURL: () => ({ 'XSRF-TOKEN': ['csrf%20token'] }) }),
      get: (url, options) => { calls.push({ method: 'GET', url, options }); return url.endsWith('/login') ? response(200, {}) : listResponse },
      post: (url, data, options) => {
        calls.push({ method: 'POST', url, body: JSON.parse(data), options })
        return url.endsWith('/login') ? response(302, {}) : response(saveStatus, { data: { id: 7, ...JSON.parse(data) } })
      },
    },
    check: (value, checks) => Object.values(checks).every((predicate) => predicate(value)),
    sleep: () => {}, abort: (message) => { throw new Error(message) },
    listLatency: metric('list'), saveLatency: metric('save'), lists: metric('lists'), saves: metric('saves'),
  })
  return { run, calls, samples }
}

test('every VU logs in once with its own account, retains sessions and creates unique records', () => {
  const first = harness(), second = harness()
  first.run(1, 0); first.run(1, 2); second.run(2, 1)
  const logins = [...first.calls, ...second.calls].filter((call) => call.method === 'POST' && call.url.endsWith('/login'))
  assert.deepEqual(logins.map((call) => call.body.email), ['load-1@example.test', 'load-2@example.test'])
  const writes = first.calls.filter((call) => call.method === 'POST' && call.url.endsWith('/assets'))
  assert.deepEqual(writes.map((call) => call.body.name), ['contract-1-0', 'contract-1-2'])
  assert.equal(writes[0].options.headers['X-XSRF-TOKEN'], 'csrf token')
  assert.equal(first.samples.list.length, 2)
  assert.equal(first.samples.save.length, 2)
})

test('redirects, throttling and failed saves abort without being counted as fast successes', () => {
  for (const status of [302, 401, 403, 429, 500]) {
    const value = harness({ listResponse: response(status, {}) })
    assert.throws(() => value.run(1, 0), /List\/relations failed/)
    assert.equal(value.samples.list.length, 0)
    assert.equal(value.samples.save.length, 0)
  }
  const value = harness({ saveStatus: 422 })
  assert.throws(() => value.run(1, 0), /Save failed/)
  assert.equal(value.samples.save.length, 0)
})
