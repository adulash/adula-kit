import assert from 'node:assert/strict'

export function requireSyntheticRehearsal(args, env) {
  assert(args.length === 1 && args[0] === '--synthetic',
    'No published predecessor is configured. Use pnpm test:upgrade:synthetic for a local regression rehearsal; it is NOT release acceptance. See docs/release-acceptance-runbook.md.')
  assert(!Object.hasOwn(env, 'ADULA_PREVIOUS_VERSION'),
    'ADULA_PREVIOUS_VERSION cannot select a published baseline in the synthetic harness. Remove it; never relabel current source as a genuine release.')
  return '0.1.0'
}
