import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class extends BaseModel {
  static table = 'tickets'
  @column({ isPrimary: true }) declare id: number
  @column() declare number: string
  @column() declare subject: string
  @column() declare priority: string
  @column() declare description: string | null
  @column() declare dueOn: string | null
  @column() declare escalated: boolean | null
  @column() declare docStatus: number
  @column() declare version: number
  @column() declare orgUnitId: number
  @column() declare createdBy: number
  @column() declare updatedBy: number
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime
  @column.dateTime() declare deletedAt: DateTime | null
}
