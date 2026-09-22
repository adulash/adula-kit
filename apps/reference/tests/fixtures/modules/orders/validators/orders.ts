import vine from '@vinejs/vine'
export const validator = vine.create({
  customerId: vine.number().positive().withoutDecimals().nullable().optional(),
  total: vine
    .string()
    .regex(/^-?\d+$/)
    .nullable()
    .optional(),
  status: vine.string().trim().minLength(1).maxLength(10000).nullable().optional(),
  notes: vine.string().trim().minLength(1).maxLength(10000).nullable().optional(),
  issuedAt: vine
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  internalNote: vine.string().trim().minLength(1).maxLength(10000).nullable().optional(),
  contract: vine.number().positive().withoutDecimals().nullable().optional(),
  lines: vine
    .array(
      vine.object({
        id: vine.number().positive().withoutDecimals().optional(),
        version: vine.number().positive().withoutDecimals().optional(),
        _delete: vine.boolean().optional(),
        description: vine.string().trim().minLength(1).maxLength(255).optional(),
        quantity: vine.number().positive().withoutDecimals().optional(),
      })
    )
    .maxLength(100)
    .nullable()
    .optional(),
})
