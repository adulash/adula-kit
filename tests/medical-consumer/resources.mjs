const label = (ar, en) => ({ ar, en })
const name = { type: 'string', label: label('الاسم', 'Name'), required: true, searchable: true }
const actions = ['view', 'create', 'update', 'delete']

// These definitions are materialized as project-owned source. Each migration embeds
// its own literal snapshot and never imports mutable resource definitions.
export const resources = [
  {
    name: 'equipment_categories', label: label('فئات الأجهزة', 'Equipment categories'), scoped: false,
    fields: { name }, list: ['name'], form: ['name'], show: ['name'], actions,
    validation: "name: vine.string().trim().minLength(1).maxLength(255)",
  },
  {
    name: 'equipment_locations', label: label('مواقع الأجهزة', 'Equipment locations'), scoped: true,
    fields: { name }, list: ['name'], form: ['name'], show: ['name'], actions,
    validation: "name: vine.string().trim().minLength(1).maxLength(255)",
  },
  {
    name: 'medical_assets', label: label('الأصول الطبية', 'Medical assets'), scoped: true, version: true,
    fields: {
      name: { ...name, label: label('رقم الأصل', 'Asset identifier'), unique: true, sortable: true },
      description: { type: 'string', label: label('اسم الجهاز', 'Equipment name'), required: true, searchable: true },
      categoryId: { type: 'belongsTo', resource: 'equipment_categories', label: label('الفئة', 'Category'), required: true },
      locationId: { type: 'belongsTo', resource: 'equipment_locations', label: label('الموقع', 'Location'), required: true },
      acquisitionCost: { type: 'money', label: label('تكلفة الشراء', 'Acquisition cost'), permissionLevel: 1 },
      acquiredAt: { type: 'date', label: label('تاريخ الشراء', 'Acquisition date') },
      manual: { type: 'attachment', label: label('دليل الجهاز', 'Equipment manual') },
      components: { type: 'hasMany', resource: 'asset_components', foreignKey: 'assetId', inline: true, label: label('المكوّنات', 'Components') },
    },
    list: ['name', 'description', 'categoryId', 'locationId', 'acquisitionCost'],
    form: ['name', 'description', 'categoryId', 'locationId', 'acquisitionCost', 'acquiredAt', 'manual', 'components'],
    show: ['name', 'description', 'categoryId', 'locationId', 'acquisitionCost', 'acquiredAt', 'manual'], actions,
    validation: `name: vine.string().trim().minLength(1).maxLength(255),
      description: vine.string().trim().minLength(1).maxLength(255),
      categoryId: vine.number().positive().withoutDecimals(),
      locationId: vine.number().positive().withoutDecimals(),
      acquisitionCost: vine.string().regex(/^\\d+$/).nullable().optional(),
      acquiredAt: vine.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).nullable().optional(),
      manual: vine.number().positive().withoutDecimals().nullable().optional(),
      components: vine.array(vine.object({
        id: vine.number().positive().withoutDecimals().optional(),
        version: vine.number().positive().withoutDecimals().optional(),
        _delete: vine.boolean().optional(),
        name: vine.string().trim().minLength(1).maxLength(255).optional(),
        quantity: vine.number().positive().withoutDecimals().optional(),
      })).maxLength(100).optional()`,
  },
  {
    name: 'asset_components', label: label('مكوّنات الأصول', 'Asset components'), scoped: true, version: true,
    fields: {
      assetId: { type: 'belongsTo', resource: 'medical_assets', label: label('الأصل', 'Asset'), required: true },
      name,
      quantity: { type: 'integer', label: label('الكمية', 'Quantity'), required: true },
    },
    list: ['assetId', 'name', 'quantity'], form: ['assetId', 'name', 'quantity'], show: ['assetId', 'name', 'quantity'], actions,
    validation: `assetId: vine.number().positive().withoutDecimals(),
      name: vine.string().trim().minLength(1).maxLength(255),
      quantity: vine.number().positive().withoutDecimals()`,
  },
]
