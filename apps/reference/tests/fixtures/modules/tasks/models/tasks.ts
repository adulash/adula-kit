import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
export default class extends BaseModel {
  static table = 'tasks'
  @column({ isPrimary: true }) declare id: number
  @column() declare title: string
  @column() declare orderId: number | null
  @column() declare done: boolean | null
  @column() declare orgUnitId: number
  @column() declare createdBy: number
  @column() declare updatedBy: number
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime
  @column.dateTime() declare deletedAt: DateTime | null
}
