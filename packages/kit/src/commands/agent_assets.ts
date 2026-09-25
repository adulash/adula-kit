import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { KIT_VERSION } from '../version.js'

const endMarker = '<!-- adula-kit:end -->'
export const digest = (text: string) =>
  createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex')
export function managedRules(text: string) {
  const start = text.indexOf('<!-- adula-kit:start')
  const end = text.indexOf(endMarker)
  return start >= 0 && end > start
    ? text.slice(start, end + endMarker.length).replace(/\r\n/g, '\n')
    : ''
}
export async function agentAssets() {
  const skills: Record<string, string> = {}
  for (const [source, target] of [
    ['idea-review', 'adula-idea-review'],
    ['adula-frontend-design', 'adula-frontend-design'],
    ['module-review', 'adula-module-review'],
    ['security-review', 'adula-security-review'],
    ['schema-review', 'adula-schema-review'],
    ['ui-review', 'adula-ui-review'],
    ['perf-review', 'adula-perf-review'],
  ]) {
    skills[`.agents/skills/${target}/SKILL.md`] = await readFile(
      new URL(`../../agent/skills/${source}/SKILL.md`, import.meta.url),
      'utf8'
    )
  }
  return {
    rules: managedRules(
      await readFile(new URL('../../agent/AGENTS.template.md', import.meta.url), 'utf8')
    ),
    skills,
  }
}
export async function syncAgentAssets(root: string) {
  const assets = await agentAssets()
  const path = join(root, 'AGENTS.md')
  let existing = ''
  try {
    existing = await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const old = managedRules(existing)
  if (!old && (existing.includes('<!-- adula-kit:start') || existing.includes(endMarker)))
    throw new Error('Malformed managed AGENTS.md boundaries; repair markers before updating')
  const normalized = existing.replace(/\r\n/g, '\n')
  await writeFile(
    path,
    old
      ? normalized.replace(old, assets.rules)
      : `${assets.rules}\n\n${existing || '## Project rules\n'}`
  )
  for (const [skill, content] of Object.entries(assets.skills)) {
    await mkdir(dirname(join(root, skill)), { recursive: true })
    await writeFile(join(root, skill), content)
  }
  await writeFile(
    join(root, 'adula.lock.json'),
    `${JSON.stringify(
      {
        version: KIT_VERSION,
        managedRules: digest(assets.rules),
        skills: Object.fromEntries(
          Object.entries(assets.skills).map(([skillPath, content]) => [skillPath, digest(content)])
        ),
      },
      null,
      2
    )}\n`
  )
}
