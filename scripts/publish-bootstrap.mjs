import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { checkRelease } from './check-release.mjs'

// npm CLI treats provenance and provenance-file as mutually exclusive even when
// provenance=false. Use its publisher and normal interactive 2FA handler directly
// so package publishConfig.provenance cannot override the supplied signed bundle.
const [npmRoot, directory, mode] = process.argv.slice(2)
assert(npmRoot && directory && ['--verify', '--publish'].includes(mode),
  'Usage: node scripts/publish-bootstrap.mjs <npm-root> <signed-artifacts> --verify|--publish')
const require = createRequire(resolve(npmRoot, 'package.json'))
assert.match(require('./package.json').version, /^11\.19\.[01]$/)
const Npm = require('./lib/npm.js')
const { otplease } = require('./lib/utils/auth.js')
const { publish } = require('libnpmpublish')
const { verifyProvenance } = require('./node_modules/libnpmpublish/lib/provenance.js')
const pacote = require('pacote')
const npa = require('npm-package-arg')
const dir = resolve(directory)
const sums = await readFile(resolve(dir, 'SHA256SUMS'), 'utf8')
for (const line of sums.trim().split(/\r?\n/)) {
  const match = line.match(/^([a-f0-9]{64})  (adula-(?:kit|ui|create-app)-[\w.-]+\.tgz)$/)
  assert(match, 'Unexpected checksum entry')
  const bytes = await readFile(resolve(dir, match[2]))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), match[1])
}
const version = await checkRelease({ artifacts: dir, channel: 'alpha' })
process.argv = [process.execPath, 'npm', 'publish', '--browser=false']
const npm = new Npm()
await npm.load()
try {
  const packages = []
  for (const name of ['kit', 'ui', 'create-app']) {
    const archive = resolve(dir, `adula-${name}-${version}.tgz`)
    const bytes = await readFile(archive)
    const manifest = await pacote.manifest(archive, { fullMetadata: true, fullReadJson: true })
    assert.equal(manifest.name, `@adula/${name}`)
    assert.equal(manifest.version, version)
    const subject = {
      name: npa.toPurl(npa.resolve(manifest.name, version)),
      digest: { sha512: createHash('sha512').update(bytes).digest('hex') },
    }
    const provenanceFile = `${archive}.sigstore`
    const bundle = await verifyProvenance(subject, provenanceFile)
    const statement = JSON.parse(Buffer.from(bundle.dsseEnvelope.payload, 'base64'))
    assert.equal(statement.predicate.buildDefinition.externalParameters.workflow.repository,
      'https://github.com/adulash/adula-kit')
    assert.equal(statement.predicate.buildDefinition.externalParameters.workflow.ref, 'refs/heads/main')
    packages.push({ manifest, bytes, provenanceFile })
    console.log(`Verified signed ${manifest.name}@${version}`)
  }
  if (mode === '--publish') {
    for (const { manifest, bytes, provenanceFile } of packages) {
      const opts = { ...npm.flatOptions, registry: 'https://registry.npmjs.org/',
        access: 'public', defaultTag: 'alpha', provenance: false, provenanceFile,
        npmVersion: npm.version, ignoreScripts: true }
      await otplease(npm, opts, (authenticated) => publish(manifest, bytes, authenticated))
      console.log(`Published ${manifest.name}@${version} on alpha with verified provenance`)
    }
  }
} finally {
  npm.unload()
}
