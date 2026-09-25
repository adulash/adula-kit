import vine from '@vinejs/vine'
export const validator = vine.create({
  ticketId: vine.number().positive().withoutDecimals(),
  body: vine.string().trim().minLength(1).maxLength(5000),
})
