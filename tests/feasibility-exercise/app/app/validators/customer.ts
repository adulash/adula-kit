import vine from '@vinejs/vine'

const optionalText = (max: number) => vine.string().trim().maxLength(max).nullable().optional()

/**
 * Create and update share the same rules. The metadata carries the id of the
 * customer being edited so it is excluded from the uniqueness check.
 * Uniqueness is case-insensitive and ignores soft-deleted rows, matching the
 * partial unique index in the database.
 */
export const customerValidator = vine.withMetaData<{ customerId?: number }>().create({
  name: vine
    .string()
    .trim()
    .minLength(2)
    .maxLength(200)
    .unique({
      table: 'customers',
      column: 'name',
      caseInsensitive: true,
      filter: (query, _value, field) => {
        query.whereNull('deleted_at')
        if (field.meta.customerId) {
          query.whereNot('id', field.meta.customerId)
        }
      },
    }),
  email: vine.string().trim().email().maxLength(254).nullable().optional(),
  phone: vine
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{6,20}$/)
    .nullable()
    .optional(),
  address: optionalText(500),
})

export const SORTABLE_COLUMNS = ['name', 'email', 'phone', 'created_at'] as const
export type SortableColumn = (typeof SORTABLE_COLUMNS)[number]

export const customerListValidator = vine.create({
  search: vine.string().trim().maxLength(100).nullable().optional(),
  sort: vine.enum(SORTABLE_COLUMNS).optional(),
  order: vine.enum(['asc', 'desc'] as const).optional(),
  page: vine.number().withoutDecimals().min(1).optional(),
})
