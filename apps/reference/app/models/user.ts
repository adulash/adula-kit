import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { beforeSave } from '@adonisjs/lucid/orm'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'

export default class User extends compose(UserSchema, withAuthFinder(hash)) {
  /** E-mail is a case-insensitive identity (unique index on lower(email)). */
  @beforeSave()
  static normalizeEmail(user: User) {
    if (user.$dirty.email) user.email = user.email.trim().toLowerCase()
  }

  get initials() {
    const [first, last] = this.fullName ? this.fullName.split(' ') : this.email.split('@')
    if (first && last) {
      return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
    }
    return `${first.slice(0, 2)}`.toUpperCase()
  }
}
