import vine from '@vinejs/vine'
export const validator = vine.create({
  subject: vine.string().trim().minLength(1).maxLength(255),
  priority: vine.string().trim().minLength(1).maxLength(40),
  description: vine.string().trim().maxLength(10000).nullable().optional(),
  dueOn: vine
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  replies: vine
    .array(
      vine.object({
        id: vine.number().positive().withoutDecimals().optional(),
        version: vine.number().positive().withoutDecimals().optional(),
        _delete: vine.boolean().optional(),
        body: vine.string().trim().minLength(1).maxLength(5000).optional(),
      })
    )
    .maxLength(100)
    .nullable()
    .optional(),
})
