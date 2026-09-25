import type { Module, Resource } from './types.js'
import { identifier } from './define_resource.js'

export class ResourceRegistry {
  #resources = new Map<string, Resource>()
  #owners = new Map<string, string>()
  #modules = new Map<string, Module>()

  register(modules: readonly Module[]) {
    const next = new ResourceRegistry()
    for (const module of modules) {
      identifier(module.name)
      if (next.#modules.has(module.name)) throw new Error(`Duplicate module: ${module.name}`)
      for (const dep of module.dependsOn)
        if (!next.#modules.has(dep))
          throw new Error(`Module ${module.name} must follow dependency ${dep}`)
      next.#modules.set(module.name, module)
      for (const resource of module.resources) {
        if (next.#resources.has(resource.name))
          throw new Error(`Duplicate resource: ${resource.name}`)
        next.#resources.set(resource.name, resource)
        next.#owners.set(resource.name, module.name)
      }
    }
    for (const resource of next.all()) {
      for (const field of Object.values(resource.fields)) {
        if (field.type !== 'belongsTo' && field.type !== 'hasMany') continue
        const target = next.get(field.resource)
        const owner = next.owner(resource.name)
        const targetOwner = next.owner(target.name)
        if (owner !== targetOwner && !next.#modules.get(owner)!.dependsOn.includes(targetOwner))
          throw new Error(`Undeclared dependency: ${owner} -> ${targetOwner}`)
        if (field.type === 'hasMany' && owner !== targetOwner)
          throw new Error('Inline children must belong to the same module')
        if (field.type === 'hasMany' && !(field.foreignKey in target.fields))
          throw new Error(`Missing child foreign key: ${field.foreignKey}`)
      }
    }
    this.#resources = next.#resources
    this.#owners = next.#owners
    this.#modules = next.#modules
    return this
  }
  get(name: string) {
    const resource = this.#resources.get(name)
    if (!resource) throw new Error(`Unknown resource: ${name}`)
    return resource
  }
  all() {
    return [...this.#resources.values()]
  }
  owner(name: string) {
    this.get(name)
    return this.#owners.get(name)!
  }
  modules() {
    return [...this.#modules.values()]
  }
  /** Workflow definitions declared by registered modules, validated against their resources. */
  workflows() {
    return this.modules().flatMap((module) => {
      for (const workflow of module.workflows ?? [])
        if (this.owner(workflow.resource) !== module.name)
          throw new Error(
            `Workflow ${workflow.name} must belong to the module of ${workflow.resource}`
          )
      return [...(module.workflows ?? [])]
    })
  }
}
