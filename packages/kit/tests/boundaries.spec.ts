import { test } from '@japa/runner'
import { Linter } from 'eslint'
// The package ships this ESLint plugin as JavaScript for host compatibility.
import plugin from '../src/eslint/index.js'

test.group('Agent boundaries', () => {
  const linter = new Linter()
  const verify = (code: string, filename = 'app/modules/orders/example.js') =>
    linter.verify(
      code,
      [
        {
          files: ['**/*.js'],
          plugins: { adula: plugin },
          rules: {
            'adula/no-cross-module-controller': 'error',
            'adula/no-direct-to-json': 'error',
            'adula/no-kit-patching': 'error',
            'adula/no-system-save-in-controllers': 'error',
          },
        },
      ],
      { filename }
    )
  test('rejects controller imports across modules', ({ assert }) => {
    assert.equal(
      verify("import Tasks from '#modules/tasks/controllers/tasks'")[0].ruleId,
      'adula/no-cross-module-controller'
    )
    assert.lengthOf(verify("import Orders from '#modules/orders/controllers/orders'"), 0)
  })
  test('rejects model toJSON and installed-package patching', ({ assert }) => {
    assert.equal(verify('record.toJSON()')[0].ruleId, 'adula/no-direct-to-json')
    assert.equal(verify("import patch from 'patch-package'")[0].ruleId, 'adula/no-kit-patching')
    assert.lengthOf(verify('serialize(resource, record, ability, actor)'), 0)
  })
  test('system writes stay out of request handlers', ({ assert }) => {
    const call = "await kit().resources.systemSave('orders', values, id, { actorId })"
    for (const file of [
      'app/controllers/orders_controller.js',
      'app/modules/orders/controllers/decisions_controller.js',
      'start/routes.js',
    ])
      assert.equal(verify(call, file)[0]?.ruleId, 'adula/no-system-save-in-controllers', file)
    assert.equal(
      verify("await resources.rehome('orders', id, { actorId })", 'start/routes.js')[0]?.ruleId,
      'adula/no-system-save-in-controllers'
    )
    // Listeners and module services may write for the system after their own checks.
    for (const file of [
      'app/modules/orders/listeners/visit_completed.js',
      'app/modules/orders/services/visits.js',
    ])
      assert.lengthOf(verify(call, file), 0, file)
  })
})
