import { BaseCommand, args } from '@adonisjs/core/ace'
import { mkdir, rename, realpath, lstat, readdir } from 'node:fs/promises'
import { dirname, join, relative, isAbsolute } from 'node:path'
import { identifier } from '../src/resource/define_resource.js'
import type { Module } from '../src/resource/types.js'

export default class ModuleRemove extends BaseCommand {
  static commandName = 'adula:module:remove'
  static description = 'Unregister and archive a reference module; preserve its database tables'
  static options = { startApp: true }
  @args.string() declare name: string
  async run() {
    identifier(this.name)
    if (this.app.inProduction)
      throw new Error('Remove reference modules in the source checkout, not in production')
    const { modules }: { modules: Module[] } = await this.app.import('#start/modules')
    const module = modules.find((entry) => entry.name === this.name)
    if (!module?.reference)
      throw new Error('Only modules explicitly marked reference: true can be removed')
    const dependents = modules.filter((entry) => entry.dependsOn.includes(this.name))
    if (dependents.length)
      throw new Error(
        `Remove dependent reference modules first: ${dependents.map((entry) => entry.name).join(', ')}`
      )
    const root = await realpath(this.app.makePath())
    const path = this.app.makePath('app/modules', this.name)
    const actual = await realpath(path)
    const inside = relative(root, actual)
    const directoryInfo = await lstat(path)
    if (directoryInfo.isSymbolicLink() || inside.startsWith('..') || isAbsolute(inside))
      throw new Error('Refusing to move a module outside the application')
    const codemods = await this.createCodemods()
    const project = await codemods.getTsMorphProject()
    if (!project) throw new Error('Module removal requires @adonisjs/assembler')
    const source = project.addSourceFileAtPathIfExists(this.app.makePath('start/modules.ts'))!
    const imported = source.getImportDeclaration(`#modules/${this.name}/module`)
    const alias = imported?.getDefaultImport()?.getText()
    const declaration = source.getVariableDeclaration('modules')?.getInitializer()
    if (!alias || !declaration || !('getElements' in declaration))
      throw new Error('Expected a literal module registry; no files were changed')
    const array = declaration as unknown as {
      getElements(): { getText(): string }[]
      removeElement(index: number): void
    }
    const index = array.getElements().findIndex((element) => element.getText() === alias)
    if (index < 0)
      throw new Error('Module import is not a literal registry item; no files were changed')
    array.removeElement(index)
    imported!.remove()
    const archive = this.app.tmpPath('adula-removed', `${this.name}-${Date.now()}`)
    await mkdir(dirname(archive), { recursive: true })
    const archiveParent = relative(root, await realpath(dirname(archive)))
    if (archiveParent.startsWith('..') || isAbsolute(archiveParent))
      throw new Error('Archive must stay inside the application')
    const moves: [string, string][] = []
    const move = async (from: string, to: string) => {
      await rename(from, to)
      moves.push([from, to])
    }
    // No delete and no database mutation. Archived source receives .bak suffixes so it is not compiled.
    const preserve = async (directory: string): Promise<void> => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = join(directory, entry.name)
        if (entry.isDirectory()) await preserve(file)
        else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name))
          await move(file, `${file}.bak`)
      }
    }
    try {
      await move(path, archive)
      await preserve(archive)
      for (const resource of module.resources) {
        const testPath = this.app.makePath(
          'tests/functional',
          `${identifier(resource.name)}.spec.ts`
        )
        try {
          await move(testPath, join(archive, `${resource.name}.spec.ts.bak`))
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
      }
      await source.save()
    } catch (error) {
      for (const [from, to] of moves.reverse()) await rename(to, from)
      throw error
    }
    this.logger.success(
      `Unregistered ${this.name}; source archived at ${archive}. Database tables and migration history were preserved.`
    )
  }
}
