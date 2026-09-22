import Resource from './resource.js'
import Doctor from './doctor.js'
import Install from './install.js'
import Capabilities from './capabilities.js'
import ModuleAdd from './module_add.js'
import ModuleRemove from './module_remove.js'
import Ui from './ui.js'
import StorageMigrate from './storage_migrate.js'
const commands = [
  Resource,
  Doctor,
  Install,
  Capabilities,
  ModuleAdd,
  ModuleRemove,
  Ui,
  StorageMigrate,
]
export async function getMetaData() {
  return commands.map((command) => {
    command.boot()
    return command.serialize()
  })
}
export async function getCommand(meta: { commandName: string }) {
  return commands.find((command) => command.commandName === meta.commandName) ?? null
}
