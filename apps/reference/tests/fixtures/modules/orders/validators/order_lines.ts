import vine from '@vinejs/vine'
export const validator = vine.create({
  orderId: vine.number().positive().withoutDecimals(),
  description: vine.string().trim().minLength(1).maxLength(10000),
  quantity: vine.number().positive().withoutDecimals(),
})
