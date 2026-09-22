function requireValue(condition, message) {
  if (!condition) throw new Error(message)
}

export function validateFixture(fixture, vus) {
  requireValue(Number.isInteger(vus) && vus > 0 && vus <= 50, 'VUS must be an integer from 1 to 50')
  requireValue(
    /^https?:\/\/[^/?#@]+$/.test(fixture.baseUrl ?? ''),
    'baseUrl must be an explicit origin without credentials or a trailing slash'
  )
  requireValue(fixture.isolated === true, 'An isolated disposable consumer is required')
  requireValue(/^[a-z][a-z0-9_]*$/.test(fixture.resource ?? ''), 'A consumer resource is required')
  requireValue(
    !['orders', 'customers', 'tasks'].includes(fixture.resource),
    'Use an independent consumer, not removed educational resources'
  )
  requireValue(
    /^[a-zA-Z][a-zA-Z0-9]*$/.test(fixture.uniqueField ?? ''),
    'A project-owned unique string field is required'
  )
  requireValue(/^[a-zA-Z0-9-]{1,32}$/.test(fixture.runId ?? ''), 'A unique runId is required')
  requireValue(
    Array.isArray(fixture.relationFields) &&
      fixture.relationFields.length === 2 &&
      new Set(fixture.relationFields).size === 2 &&
      fixture.relationFields.every((field) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(field)),
    'Two distinct belongsTo fields are required'
  )
  requireValue(
    Array.isArray(fixture.users) && fixture.users.length >= vus,
    'Provide a distinct authorized user per VU'
  )
  const users = fixture.users.slice(0, vus)
  requireValue(
    users.every(
      (user) =>
        typeof user.email === 'string' &&
        user.email.trim() &&
        typeof user.password === 'string' &&
        user.password &&
        user.saveBody &&
        typeof user.saveBody === 'object' &&
        !Array.isArray(user.saveBody)
    ),
    'Every user needs credentials and a valid saveBody'
  )
  requireValue(
    new Set(users.map((user) => user.email.trim().toLowerCase())).size === vus,
    'Shared user credentials invalidate the workload'
  )
}

function bodyOf(response) {
  try {
    return response.json()
  } catch {
    return null
  }
}

export function validList(response, relationFields) {
  const body = bodyOf(response)
  return (
    response.status === 200 &&
    Array.isArray(body?.data) &&
    body.data.length > 0 &&
    body.data.every((row) =>
      relationFields.every(
        (field) =>
          row[field] != null &&
          Array.isArray(body.related?.[field]) &&
          body.related[field].some((related) => related.id === row[field])
      )
    )
  )
}

export function createWorkload(
  fixture,
  { http, check, sleep, abort, listLatency, saveLatency, lists, saves }
) {
  let signedIn = false
  const base = fixture.baseUrl
  const path = `${base}/resources/${fixture.resource}`
  const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' }
  const csrfHeaders = () => ({
    ...headers,
    'X-XSRF-TOKEN': decodeURIComponent(
      http.cookieJar().cookiesForURL(base)['XSRF-TOKEN']?.[0] ?? ''
    ),
  })
  return (vu, iteration) => {
    const user = fixture.users[vu - 1]
    if (!user) return abort('No dedicated account for this VU')
    if (!signedIn) {
      const page = http.get(`${base}/login`, { redirects: 0 })
      if (!check(page, { 'login page available': (r) => r.status === 200 }))
        return abort('Login page failed')
      const login = http.post(
        `${base}/login`,
        JSON.stringify({ email: user.email, password: user.password }),
        {
          headers: csrfHeaders(),
          redirects: 0,
        }
      )
      if (!check(login, { 'login redirects': (r) => r.status === 302 }))
        return abort('Login failed')
      // A redirect alone is not authentication evidence: the authorized list below must succeed.
      signedIn = true
    }
    const list = http.get(`${path}?limit=50`, { headers, redirects: 0 })
    if (
      check(list, {
        'authorized list has both relations': (r) => validList(r, fixture.relationFields),
      })
    ) {
      listLatency.add(list.timings.duration)
      lists.add(1)
    } else return abort('List/relations failed; latency sample rejected')
    const value = `${fixture.runId}-${vu}-${iteration}`
    const response = http.post(
      path,
      JSON.stringify({ ...user.saveBody, [fixture.uniqueField]: value }),
      {
        headers: csrfHeaders(),
        redirects: 0,
      }
    )
    if (
      check(response, {
        'save returns the created record': (r) => {
          const body = bodyOf(r)
          return (
            r.status === 201 && body?.data?.id != null && body.data[fixture.uniqueField] === value
          )
        },
      })
    ) {
      saveLatency.add(response.timings.duration)
      saves.add(1)
    } else return abort('Save failed; latency sample rejected')
    // At most 120 resource requests/minute/user; preserve the production limiter.
    sleep(1)
  }
}
