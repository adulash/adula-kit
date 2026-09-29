import type { Resource, SerializedRecord } from '../resource/types.js'

const TITLE_TYPES = new Set(['string', 'text', 'integer', 'money', 'date', 'datetime', 'lookup'])

/**
 * The fields that name a record wherever it is referenced (#47, #32): the resource's
 * `title`, or else its first sequence field and its first text field in `list`. Lookup
 * keys are never shown raw; declared lookup fields are shown by their Arabic label.
 */
export function titleFields(resource: Pick<Resource, 'fields' | 'list' | 'title'>): string[] {
  if (resource.title) return [...resource.title]
  const sequence = Object.keys(resource.fields).find((key) => resource.fields[key].sequence)
  const text = resource.list.find((key) => {
    const field = resource.fields[key]
    return (field.type === 'string' || field.type === 'text') && !field.sequence
  })
  return [sequence, text].filter((key): key is string => key !== undefined)
}

/** Definition check: title fields exist, are readable and have a displayable type. */
export function assertTitle(
  resource: Pick<Resource, 'name' | 'fields' | 'list' | 'show' | 'serialize' | 'title'>
) {
  if (!resource.title) return
  if (!resource.title.length) throw new Error(`${resource.name}: title needs at least one field`)
  const readable = new Set(resource.serialize ?? [...resource.list, ...resource.show])
  for (const key of resource.title) {
    const field = resource.fields[key]
    if (!field) throw new Error(`Unknown field: ${key}`)
    if (!TITLE_TYPES.has(field.type))
      throw new Error(`${resource.name}: title field ${key} cannot be a ${field.type}`)
    if (!readable.has(key))
      throw new Error(`${resource.name}: title field ${key} must be serialized`)
  }
}

/**
 * The title of one serialized record, read after field-level filtering so it never shows
 * a value the viewer may not read. Returns null when no title field has a value.
 */
export function formatTitle(
  resource: Pick<Resource, 'fields' | 'list' | 'title'>,
  record: SerializedRecord,
  lookupLabel: (group: string, key: string) => string | undefined
): string | null {
  const parts: string[] = []
  for (const key of titleFields(resource)) {
    const value = record[key]
    if (value === null || value === undefined || value === '') continue
    const field = resource.fields[key]
    parts.push(
      field.type === 'lookup'
        ? (lookupLabel(field.group, String(value)) ?? String(value))
        : String(value)
    )
  }
  return parts.length ? parts.join(' · ') : null
}
