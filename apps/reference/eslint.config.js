import { configApp } from '@adonisjs/eslint-config'
import adula from '../../packages/adula/src/eslint/index.js'

export default configApp({
  files: ['app/modules/**/*.ts', 'app/controllers/**/*.ts'],
  plugins: { adula },
  rules: {
    'adula/no-cross-module-controller': 'error',
    'adula/no-direct-to-json': 'error',
    'adula/no-core-patching': 'error',
    'adula/no-system-save-in-controllers': 'error',
  },
})
