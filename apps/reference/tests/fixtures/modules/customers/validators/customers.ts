import vine from '@vinejs/vine'
export const validator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(10000),
  email: vine.string().trim().minLength(1).maxLength(10000).nullable().optional(),
})
