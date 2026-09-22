import db from '@adonisjs/lucid/services/db'
import type { FixtureContext, ContractFixture } from '#tests/helpers/resource_contract'

export async function medicalFixture(name: string, ctx: FixtureContext): Promise<ContractFixture> {
  const knex = db.connection().getWriteClient()
  const audit = { created_by: ctx.userId, updated_by: ctx.userId }
  const value = `اختبار ${ctx.unique}`
  if (name === 'equipment_categories' || name === 'equipment_locations')
    return { input: { name: value }, expected: { name: value }, update: { name: `${value} محدث` }, updated: { name: `${value} محدث` } }
  const [category] = await knex('equipment_categories').insert({ name: value, ...audit }).returning('id')
  const [location] = await knex('equipment_locations').insert({ name: value, org_unit_id: ctx.orgUnitId, ...audit }).returning('id')
  const values = {
    name: value, description: 'جهاز مراقبة', categoryId: category.id, locationId: location.id,
    acquisitionCost: '125000', acquiredAt: '2026-09-22', manual: null,
  }
  if (name === 'medical_assets') return {
    input: { ...values, components: [{ name: 'مجس', quantity: 2 }] }, expected: values,
    inline: { components: [{ name: 'مجس', quantity: 2 }] },
    update: { ...values, description: 'جهاز محدث' }, updated: { ...values, description: 'جهاز محدث' },
  }
  const [asset] = await knex('medical_assets').insert({
    name: value, description: 'أصل للمكوّن', category_id: category.id, location_id: location.id,
    org_unit_id: ctx.orgUnitId, ...audit,
  }).returning('id')
  const component = { assetId: asset.id, name: value, quantity: 1 }
  return { input: component, expected: component, update: { ...component, quantity: 3 }, updated: { ...component, quantity: 3 } }
}
