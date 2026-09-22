import type { ApplicationService } from '@adonisjs/core/types'
import { ResourceRegistry } from '../src/resource/registry.js'
export default class KitProvider {
  constructor(protected app: ApplicationService) {}
  register() {
    this.app.container.singleton(ResourceRegistry, () => new ResourceRegistry())
  }
}
