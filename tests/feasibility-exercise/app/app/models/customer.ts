import { CustomerSchema } from '#database/schema'
import Unit from '#models/unit'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

export default class Customer extends CustomerSchema {
  @belongsTo(() => Unit)
  declare unit: BelongsTo<typeof Unit>

  /**
   * Active (not soft-deleted) customers. Every read path must start here.
   */
  static active(): ModelQueryBuilderContract<typeof Customer> {
    return this.query().whereNull('deleted_at')
  }
}
