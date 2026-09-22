import { test } from '@japa/runner'
import { Linter } from 'eslint'
// The package ships this ESLint plugin as JavaScript for host compatibility.
import plugin from '../src/eslint/index.js'

test.group('Agent boundaries', () => {
  const linter = new Linter()
  const verify = (code: string) =>
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
          },
        },
      ],
      { filename: 'app/modules/orders/example.js' }
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
})
