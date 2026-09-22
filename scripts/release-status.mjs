import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { checkRelease } from './check-release.mjs'

// Read-only diagnostic. Only check-release and the protected workflow authorize a channel.
export async function releaseStatus(root = fileURLToPath(new URL('../', import.meta.url))) {
  const readiness = JSON.parse(await readFile(resolve(root, 'docs/release-readiness.json'), 'utf8'))
  const channels = {}
  for (const channel of ['alpha', 'next', 'latest']) {
    try {
      await checkRelease({ root, channel })
      channels[channel] = { guardPassed: true }
    } catch (error) {
      channels[channel] = { guardPassed: false, reason: error.message }
    }
  }
  return {
    version: readiness.version,
    target: readiness.target,
    channels,
    publicationAuthorized: false,
    phases: readiness.phases.map((phase) => ({
      id: phase.id,
      status: phase.status,
      requiredFor: phase.id <= 1 ? ['next', 'latest'] : ['latest'],
      remaining: phase.remaining ?? '',
      evidence: phase.evidence,
    })),
    runbook: 'docs/release-acceptance-runbook.md',
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2)
    if (args.length && (args.length !== 1 || args[0] !== '--json'))
      throw new Error('Usage: pnpm release:status [--json]')
    const report = await releaseStatus()
    if (args.includes('--json')) console.log(JSON.stringify(report, null, 2))
    else {
      console.log(`Release acceptance: ${report.version} -> ${report.target}`)
      for (const [channel, result] of Object.entries(report.channels))
        console.log(`${channel}: ${result.guardPassed ? 'guard passed; external publication approval still required' : `BLOCKED: ${result.reason}`}`)
      for (const phase of report.phases)
        console.log(`Phase ${phase.id} [${phase.status}; ${phase.requiredFor.join('/')}]: ${phase.remaining}`)
      console.log(`Execution/evidence checklist: ${report.runbook}`)
    }
    if (Object.values(report.channels).some((channel) => !channel.guardPassed)) process.exitCode = 1
  } catch (error) {
    console.error(`Release status failed: ${error.message}`)
    process.exitCode = 1
  }
}
