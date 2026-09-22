import { mkdir, readFile, writeFile, access, glob } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { identifier } from '../resource/define_resource.js'
import { appendMarkedItem } from './source_markers.js'

export async function generateResource(root: string, name: string, module: string) {
  identifier(name)
  identifier(module)
  for await (const existing of glob(`app/modules/*/resources/${name}.ts`, { cwd: root }))
    throw new Error(`Refusing to overwrite resource registered at ${existing}`)
  const base = resolve(root, 'app/modules', module)
  const title = name.replace(/_/g, ' ')
  const relative = `app/modules/${module}`
  const resourceSource = `import { defineResource } from '@adula/kit'\nimport Model from '#modules/${module}/models/${name}'\nimport { validator } from '#modules/${module}/validators/${name}'\n\nexport default defineResource({\n  name: '${name}', label: { ar: '${title}', en: '${title}' }, model: Model, scoped: true,\n  fields: { title: { type: 'string', label: { ar: 'العنوان', en: 'Title' }, required: true, searchable: true } },\n  list: ['title'], form: ['title'], show: ['title'],\n  actions: ['view', 'create', 'update', 'delete'], validator,\n})\n`
  const migration = {
    name,
    scoped: true,
    fields: {
      title: {
        type: 'string',
        label: { ar: 'العنوان', en: 'Title' },
        required: true,
        searchable: true,
      },
    },
  }
  const files: Record<string, string> = {
    [`${relative}/resources/${name}.ts`]: resourceSource,
    [`${relative}/models/${name}.ts`]: `import { BaseModel, column } from '@adonisjs/lucid/orm'\nimport { DateTime } from 'luxon'\n\nexport default class extends BaseModel {\n  static table = '${name}'\n  @column({ isPrimary: true }) declare id: number\n  @column() declare title: string\n  @column() declare orgUnitId: number\n  @column() declare createdBy: number\n  @column() declare updatedBy: number\n  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime\n  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime\n  @column.dateTime() declare deletedAt: DateTime | null\n}\n`,
    [`${relative}/validators/${name}.ts`]: `import vine from '@vinejs/vine'\nexport const validator = vine.create({ title: vine.string().trim().minLength(1).maxLength(255) })\n`,
    [`${relative}/migrations/${Date.now()}_create_${name}.ts`]: `import { BaseSchema } from '@adonisjs/lucid/schema'\nimport { createResourceTable } from '@adula/kit'\nexport default class extends BaseSchema {\n  async up() { await createResourceTable(this.db.getWriteClient(), ${JSON.stringify(migration, null, 2)}) }\n  async down() { throw new Error('Use an expand/contract migration or restore a backup') }\n}\n`,
    [`${relative}/factories/${name}.ts`]: `import factory from '@adonisjs/lucid/factories'\nimport Model from '#modules/${module}/models/${name}'\nexport default factory.define(Model, ({ faker }) => ({ title: faker.lorem.words(3) })).build()\n`,
    [`tests/functional/${name}.spec.ts`]: `import { resourceContract } from '#tests/helpers/resource_contract'\n\n// Extend this fixture whenever the resource form or its validator changes.\nresourceContract('${name}', ({ unique }) => ({\n  input: { title: 'سجل ' + unique },\n  expected: { title: 'سجل ' + unique },\n  update: { title: 'سجل محدث ' + unique },\n  updated: { title: 'سجل محدث ' + unique },\n}))\n`,
  }
  const modulePath = join(base, 'module.ts')
  let current: string
  try {
    current = await readFile(modulePath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    current = `// adula:imports\nexport default { name: '${module}', label: { ar: '${module}', en: '${module}' }, dependsOn: [], resources: [/* adula:resources */] }\n`
  }
  if (!current.includes('// adula:imports') || !current.includes('/* adula:resources */'))
    throw new Error('Module registration markers are missing; no files were changed')
  const modulesPath = join(root, 'start/modules.ts')
  const modules = await readFile(modulesPath, 'utf8')
  if (!modules.includes('// adula:imports') || !modules.includes('/* adula:modules */'))
    throw new Error('Module index markers are missing; no files were changed')
  for (const file of Object.keys(files)) {
    try {
      await access(join(root, file))
      throw new Error(`Refusing to overwrite ${file}`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  for (const [file, content] of Object.entries(files)) {
    const path = join(root, file)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, content, { flag: 'wx' })
  }
  await mkdir(base, { recursive: true })
  await writeFile(
    modulePath,
    appendMarkedItem(
      current.replace(
        '// adula:imports',
        `import resource_${name} from './resources/${name}.js'\n// adula:imports`
      ),
      '/* adula:resources */',
      `resource_${name}`
    )
  )
  if (!modules.includes(`'#modules/${module}/module'`))
    await writeFile(
      modulesPath,
      appendMarkedItem(
        modules.replace(
          '// adula:imports',
          `import module_${module} from '#modules/${module}/module'\n// adula:imports`
        ),
        '/* adula:modules */',
        `module_${module}`
      )
    )
  return Object.keys(files)
}
