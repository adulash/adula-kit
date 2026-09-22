import vine from '@vinejs/vine'
export const validator = vine.create({
  title: vine.string().trim().minLength(1).maxLength(10000),
  orderId: vine.number().positive().withoutDecimals().nullable().optional(),
  done: vine.boolean().nullable().optional(),
})
