export const KIT_ISSUES_URL = 'https://github.com/adulash/adula-kit/issues'

/**
 * KIT_GAPS.md entry fields, in the order of the kit's gap issue form
 * (.github/ISSUE_TEMPLATE/gap.yml). `id` is the form field id used to prefill it.
 */
export const GAP_FIELDS = [
  { label: 'Package', id: 'package', required: true },
  { label: 'Needed by', id: 'needed', required: true },
  { label: 'Tried', id: 'tried', required: true },
  { label: 'Blocked because', id: 'blocked', required: true },
  { label: 'Proposed kit change', id: 'proposal', required: true },
  { label: 'Reproduction', id: 'reproduction', required: true },
  { label: 'Acceptance', id: 'acceptance', required: true },
  { label: 'Workaround', id: 'workaround', required: false },
] as const

export const GAPS_TEMPLATE = `# Kit gaps

Record each limitation of the kit as one entry. Describe the kit capability, not this
project: reproduce it on a new application from create-app. Run \`node ace adula:gaps report\`
to open the kit's gap form prefilled, then write the issue number in \`Issue:\`.

<!--
## GAP-001 — Short title naming the kit capability
Package: @adula/kit 1.0.0
Needed by: the kit capability that is missing, stated without project details
Tried: the kit extension points tried
Blocked because: why none of them works
Proposed kit change: the API, option or fix the kit should offer
Reproduction: steps on a new application from create-app
Acceptance: the test that proves the gap is closed
Workaround: none, or what the project does meanwhile
Issue:
-->
`

/** Longest value put in one prefilled field; GitHub rejects very long URLs. */
const FIELD_LIMIT = 1500
const labels = [...GAP_FIELDS.map((field) => field.label), 'Issue']
const fieldLine = new RegExp(`^(${labels.join('|')}):\\s*(.*)$`)

export interface GapEntry {
  title: string
  fields: Record<string, string>
  issue: string
  missing: string[]
  url?: string
}

function parseGaps(masked: string) {
  const gaps: GapEntry[] = []
  let current: GapEntry | undefined
  let field: string | undefined
  let comment = false
  for (const line of masked.split(/\r?\n/)) {
    if (line.trim().startsWith('<!--')) comment = true
    if (comment) {
      if (line.includes('-->')) comment = false
      continue
    }
    const heading = line.match(/^## (GAP-\d+.*)$/)
    if (heading) {
      current = { title: heading[1].trim(), fields: {}, issue: '', missing: [] }
      gaps.push(current)
      field = undefined
      continue
    }
    if (!current) continue
    if (line.startsWith('#')) {
      current = undefined
      continue
    }
    const match = line.match(fieldLine)
    if (match) {
      field = match[1]
      if (field === 'Issue') current.issue = match[2].trim()
      else current.fields[field] = match[2].trim()
    } else if (field && field !== 'Issue') {
      current.fields[field] = `${current.fields[field]}\n${line}`.trim()
    }
  }
  return gaps
}

function clip(value: string) {
  return value.length > FIELD_LIMIT
    ? `${value.slice(0, FIELD_LIMIT)}\n… (shortened; copy the rest from the masked report)`
    : value
}

/**
 * Prepares KIT_GAPS.md for sharing with the kit maintainers: e-mails, URLs and
 * IPv4 addresses are masked, gap titles are listed for a quick review, and each
 * unreported gap gets a link that opens the kit's gap form prefilled. Nothing is sent.
 */
export function gapReport(content: string, issuesUrl = KIT_ISSUES_URL) {
  const masked = content
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<email>')
    .replace(/https?:\/\/[^\s)]+/g, '<url>')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '<ip>')
  const gaps = parseGaps(masked)
  for (const gap of gaps) {
    gap.missing = GAP_FIELDS.filter((field) => field.required && !gap.fields[field.label]).map(
      (field) => field.label
    )
    if (gap.issue) continue
    const url = new URL(`${issuesUrl}/new`)
    url.searchParams.set('template', 'gap.yml')
    url.searchParams.set('title', gap.title.replace(/^GAP-\d+\s*[—–-]?\s*/, ''))
    for (const field of GAP_FIELDS) {
      const value = gap.fields[field.label]
      if (value) url.searchParams.set(field.id, clip(value))
    }
    gap.url = url.toString()
  }
  return { masked, titles: gaps.map((gap) => gap.title), gaps }
}
