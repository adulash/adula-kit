import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findRetiredNames } from '../../scripts/check-naming.mjs'

const retired = ['k', 'it'].join('')
const Retired = retired[0].toUpperCase() + retired.slice(1)

test('the retired name is found as a word, path, identifier or constant', () => {
  const findings = findRetiredNames([
    ['README.md', `Install the ${retired} first.`],
    ['src/errors.ts', `export class ${Retired}Error {}`],
    ['src/version.ts', `export const ${retired.toUpperCase()}_VERSION = '1'`],
    ['package.json', `"@adula/${retired}": "1.2.0"`],
    [`docs/${retired}-guide.md`, 'clean text'],
  ])
  assert.deepEqual(
    findings.map((finding) => finding.split(':')[0]),
    ['README.md', 'src/errors.ts', 'src/version.ts', 'package.json', `docs/${retired}-guide.md`]
  )
})

test('other words, external names and allowed records pass', () => {
  assert.deepEqual(
    findRetiredNames([
      ['src/a.ts', `import { x } from 'es-tool${retired}'; const ${retired}chen = 'web${retired}'`],
      ['scripts/b.mjs', `checkout adonisjs/starter-${retired}s`],
      ['docs/evidence/old.json', `"@adula/${retired}"`],
      ['docs/decisions/039-adulajs.md', `renamed from @adula/${retired}`],
      ['packages/adula/src/upgrade/legacy.ts', `const RETIRED = '${retired}'`],
    ]),
    []
  )
})
