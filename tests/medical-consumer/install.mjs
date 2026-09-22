import assert from 'node:assert/strict'
import { readFile, writeFile, readdir, mkdir, copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resources } from './resources.mjs'

// Only called after the CLI generates a new medical module in a new consumer.
// Generated initial migrations have not run yet; subsequent released migrations
// must be additive and are never rewritten by this installer.
export async function installMedicalModule(root) {
  const base = join(root, 'app/modules/medical')
  const migrationNames = await readdir(join(base, 'migrations'))
  for (const { validation, ...resource } of resources) {
    const resourcePath = join(base, 'resources', `${resource.name}.ts`)
    const source = await readFile(resourcePath, 'utf8')
    assert(source.includes("label: { ar: 'العنوان', en: 'Title' }"), 'Refusing to overwrite a customized resource')
    await writeFile(resourcePath, `import { defineResource } from '@adula/kit'\nimport Model from '../models/${resource.name}.js'\nimport { validator } from '../validators/${resource.name}.js'\nexport default defineResource({\n...${JSON.stringify(resource, null, 2)}, model: Model, validator,\n})\n`)
    await writeFile(join(base, 'validators', `${resource.name}.ts`), `import vine from '@vinejs/vine'\nexport const validator = vine.create({${validation}})\n`)
    await writeFile(join(root, 'tests/functional', `${resource.name}.spec.ts`), `import { resourceContract } from '#tests/helpers/resource_contract'\nimport { medicalFixture } from '#tests/medical/fixture'\nresourceContract('${resource.name}', (context) => medicalFixture('${resource.name}', context))\n`)
    const columns = Object.entries(resource.fields).filter(([, field]) => field.type !== 'hasMany').map(([key, field]) =>
      `  @column() declare ${key}: ${['belongsTo', 'integer', 'attachment'].includes(field.type) ? 'number' : 'string'}${field.required ? '' : ' | null'}`)
    await writeFile(join(base, 'models', `${resource.name}.ts`), `import { BaseModel, column } from '@adonisjs/lucid/orm'\nimport { DateTime } from 'luxon'\nexport default class extends BaseModel {\n  static table = '${resource.name}'\n  @column({ isPrimary: true }) declare id: number\n${columns.join('\n')}\n${resource.scoped ? '  @column() declare orgUnitId: number\n' : ''}${resource.version ? '  @column() declare version: number\n' : ''}  @column() declare createdBy: number\n  @column() declare updatedBy: number\n  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime\n  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime\n  @column.dateTime() declare deletedAt: DateTime | null\n}\n`)
    // Keep the generated factory usable without pretending foreign keys are valid.
    await writeFile(join(base, 'factories', `${resource.name}.ts`), `import factory from '@adonisjs/lucid/factories'\nimport Model from '../models/${resource.name}.js'\nexport default factory.define(Model, ({ faker }) => ({ name: faker.lorem.words(3) })).build()\n`)
    const matches = migrationNames.filter((name) => name.endsWith(`_create_${resource.name}.ts`))
    assert.equal(matches.length, 1)
    const { name, scoped, fields, version } = resource
    await writeFile(join(base, 'migrations', matches[0]), `import { BaseSchema } from '@adonisjs/lucid/schema'\nimport { createResourceTable } from '@adula/kit'\n// Immutable initial schema snapshot; do not import the resource definition.\nexport default class extends BaseSchema {\n  async up() { await createResourceTable(this.db.getWriteClient(), ${JSON.stringify({ name, scoped, version, fields }, null, 2)}) }\n  async down() { throw new Error('Use an expand/contract migration or restore a backup') }\n}\n`)
  }
  const modulePath = join(base, 'module.ts')
  await writeFile(modulePath, (await readFile(modulePath, 'utf8')).replace("ar: 'medical', en: 'medical'", "ar: 'الأصول الطبية', en: 'Medical assets'"))
  await mkdir(join(root, 'tests/medical'), { recursive: true })
  await copyFile(new URL('./fixture.ts', import.meta.url), join(root, 'tests/medical/fixture.ts'))
  await copyFile(new URL('./atomicity.spec.ts', import.meta.url), join(root, 'tests/functional/medical_atomicity.spec.ts'))
  await mkdir(join(root, 'commands'), { recursive: true })
  await copyFile(new URL('./seed.ts', import.meta.url), join(root, 'commands/medical_seed.ts'))
  await copyFile(new URL('./blueprint.md', import.meta.url), join(root, 'docs/medical-assets-blueprint.md'))
}
