import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

// npm's own signer produces the same bundle accepted by --provenance-file.
// Pin its version in the workflow because this is an internal npm API.
assert.equal(process.env.GITHUB_ACTIONS, 'true')
assert.equal(process.env.GITHUB_REPOSITORY, 'adulash/adula-kit')
assert.equal(process.env.GITHUB_REF, 'refs/heads/main')
assert.equal(process.env.GITHUB_SHA, process.env.RELEASE_SHA, 'Sign only the current main release')
const require = createRequire(resolve(process.argv[2], 'package.json'))
assert.equal(require('./package.json').version, '11.19.1')
const { generateProvenance, verifyProvenance } = require('./node_modules/libnpmpublish/lib/provenance.js')
const npa = require('npm-package-arg')
const { version } = JSON.parse(await readFile('packages/kit/package.json', 'utf8'))
assert.match(version, /^\d+\.\d+\.\d+-alpha\.\d+$/)
for (const name of ['kit', 'ui', 'create-app']) {
  const archive = `.work/release/adula-${name}-${version}.tgz`
  const subject = {
    name: npa.toPurl(npa.resolve(`@adula/${name}`, version)),
    digest: { sha512: createHash('sha512').update(await readFile(archive)).digest('hex') },
  }
  const bundle = await generateProvenance([subject], {})
  await writeFile(`${archive}.sigstore`, JSON.stringify(bundle))
  await verifyProvenance(subject, `${archive}.sigstore`)
  console.log(`Signed and verified @adula/${name}@${version}`)
}
