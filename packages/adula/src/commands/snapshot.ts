import type { Resource } from '../resource/types.js'

const EMBEDDED = /(createResourceTable\([^,]+,\s*)(\{[\s\S]*\})(\s*\)\s*\})/

/**
 * The part of a resource definition createResourceTable reads, as a generated
 * create-migration embeds it. Labels are kept so the migration stays readable.
 */
export function resourceSnapshot(
  resource: Pick<
    Resource,
    'name' | 'scoped' | 'version' | 'submittable' | 'customFields' | 'fields'
  >
) {
  return {
    name: resource.name,
    scoped: resource.scoped,
    ...(resource.version ? { version: true } : {}),
    ...(resource.submittable ? { submittable: true } : {}),
    ...(resource.customFields ? { customFields: true } : {}),
    fields: Object.fromEntries(
      Object.entries(resource.fields)
        .filter(([, field]) => field.type !== 'hasMany')
        .map(([key, field]) => [
          key,
          {
            type: field.type,
            label: field.label,
            ...(field.type === 'belongsTo' ? { resource: field.resource } : {}),
            ...(field.column ? { column: field.column } : {}),
            ...(field.required ? { required: true } : {}),
            ...(field.unique ? { unique: true } : {}),
            ...(field.searchable ? { searchable: true } : {}),
            ...(field.sequence ? { sequence: field.sequence } : {}),
          },
        ])
    ),
  }
}

/** The resource name embedded in a generated create-migration, if the source is one. */
export function embeddedResource(source: string): string | undefined {
  const embedded = EMBEDDED.exec(source)?.[2]
  if (!embedded) return undefined
  try {
    const parsed = JSON.parse(embedded)
    return typeof parsed?.name === 'string' ? parsed.name : undefined
  } catch {
    return undefined
  }
}

/** Replaces the embedded definition of a generated create-migration (#20). */
export function rewriteResourceSnapshot(
  source: string,
  snapshot: ReturnType<typeof resourceSnapshot>
) {
  if (embeddedResource(source) !== snapshot.name)
    throw new Error(`The migration does not embed the ${snapshot.name} definition`)
  return source.replace(
    EMBEDDED,
    (_, before: string, _old: string, after: string) =>
      `${before}${JSON.stringify(snapshot, null, 2)}${after}`
  )
}
