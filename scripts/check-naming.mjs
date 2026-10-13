// AdulaJS 2.0 retired the 1.x project name (ADR 039). It may remain only in dated
// records and in the code that upgrades 1.x applications away from it.
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RETIRED = ['k', 'it'].join('')

/** Paths allowed to keep the retired name, with the reason. */
export const ALLOWED = [
  [/^docs\/evidence\//, 'dated release evidence'],
  [/^docs\/decisions\//, 'decision records describe what was true when written'],
  [/^CHANGELOG\.md$/, 'release history'],
  [/^docs\/upgrade-2\.0\.md$/, 'tells 1.x users which names the upgrade replaces'],
  [/^docs\/(release-packet-1\.0|acceptance-1\.0|npm-acceptance-review-2026-09-22|local-staging)\.md$/, 'dated 1.x records'],
  [/^docs\/release-readiness\.json$/, 'dated acceptance record'],
  [/^tests\/(feasibility|agent)-exercise\//, 'recorded exercises'],
  [/^packages\/adula\/src\/upgrade\/legacy\.ts$/, 'the one table of 1.x names in the core package'],
  [/^packages\/create-adula-app\/src\/upgrade\.mjs$/, 'the upgrade rewrites 1.x imports'],
  [/^packages\/create-adula-app\/tests\/upgrade\.test\.mjs$/, 'fixture of a 1.x application'],
  [/^scripts\/test-upgrade\.mjs$/, 'installs the published 1.x baseline'],
  [/^scripts\/prepare-consumer\.mjs$/, 'installs the published 1.x baseline'],
  [/^\.claude\//, 'local planning notes'],
  [/(^|\/)pnpm-lock\.yaml$/, 'generated; integrity hashes'],
]

/** Matches the retired name as a word or identifier part, not inside other words. */
export const RETIRED_NAME = new RegExp(
  `(?<![A-Za-z])[${RETIRED[0].toUpperCase()}${RETIRED[0]}]${RETIRED.slice(1)}(?![a-z])|(?<![A-Za-z])${RETIRED.toUpperCase()}(?![A-Z])`
)

export function findRetiredNames(files) {
  const findings = []
  for (const [path, text] of files) {
    if (ALLOWED.some(([pattern]) => pattern.test(path))) continue
    if (RETIRED_NAME.test(path)) findings.push(`${path}: file name`)
    text.split(/\r?\n/).forEach((line, index) => {
      if (RETIRED_NAME.test(line)) findings.push(`${path}:${index + 1}: ${line.trim().slice(0, 120)}`)
    })
  }
  return findings
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
  const files = []
  for (const path of paths) {
    let buffer
    try {
      buffer = await readFile(join(root, path))
    } catch {
      continue
    }
    // Binary files carry no prose; a NUL byte in the first 8 KiB marks them.
    if (buffer.subarray(0, 8192).includes(0) && !/\.(?:tsx?|mjs|js|md)$/.test(path)) continue
    files.push([path, buffer.toString('utf8')])
  }
  const findings = findRetiredNames(files)
  if (findings.length) {
    console.error(`The retired 1.x name appears outside the allowed records (ADR 039):\n${findings.join('\n')}`)
    process.exit(1)
  }
  console.log(`Naming check passed: ${files.length} files.`)
}
