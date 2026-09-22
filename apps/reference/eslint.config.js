import { configApp } from '@adonisjs/eslint-config'
import kit from '../../packages/kit/src/eslint/index.js'

export default configApp({
  files: ['app/modules/**/*.ts', 'app/controllers/**/*.ts'],
  plugins: { adula: kit },
  rules: {
    'adula/no-cross-module-controller': 'error',
    'adula/no-direct-to-json': 'error',
    'adula/no-kit-patching': 'error',
  },
})
