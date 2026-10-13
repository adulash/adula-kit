import { assert } from '@japa/assert'
import { configure, processCLIArgs, run } from '@japa/runner'
import { db } from '../tests/helpers.js'

processCLIArgs(process.argv.splice(2))

configure({
  files: ['tests/**/*.spec.ts'],
  plugins: [assert()],
  timeout: 30000,
  teardown: [() => db.destroy()],
})

run()
