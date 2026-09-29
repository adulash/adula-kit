import vine from '@vinejs/vine'
export const validator = vine.create({
  reference: vine.string().trim().minLength(1).maxLength(10000),
  scan: vine.number().positive().withoutDecimals().nullable().optional(),
})
