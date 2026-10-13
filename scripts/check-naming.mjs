// `pnpm check:naming`: fails when the retired 1.x name appears outside the allowed records.
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findRetiredNames } from './naming.mjs'

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
  console.error(
    `The retired 1.x name appears outside the allowed records (ADR 039):\n${findings.join('\n')}`
  )
  process.exit(1)
}
console.log(`Naming check passed: ${files.length} files.`)
