import vine from '@vinejs/vine'
export const validator = vine.create({
  inspector: vine.number().positive().withoutDecimals(),
  findings: vine.string().trim().maxLength(10000).nullable().optional(),
})
