import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
export default class extends BaseModel {
  static table = 'orders'
  @column({ isPrimary: true }) declare id: number
  @column() declare number: string
  @column() declare customerId: number | null
  @column() declare total: string | null
  @column() declare status: string | null
  @column() declare notes: string | null
  @column() declare issuedAt: string | null
  @column() declare internalNote: string | null
  @column() declare contract: number | null
  @column() declare orgUnitId: number
  @column() declare version: number
  @column() declare docStatus: number
  @column() declare amendedFromId: number | null
  @column() declare createdBy: number
  @column() declare updatedBy: number
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime
  @column.dateTime() declare deletedAt: DateTime | null
}
