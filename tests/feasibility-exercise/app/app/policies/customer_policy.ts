import type User from '#models/user'
import type Customer from '#models/customer'

/**
 * Authorization rules for customers (server side, the only source of truth).
 *
 * - Every user sees only the customers of their own unit.
 * - Only managers create, edit and delete, and only inside their own unit.
 * - A user without a unit sees nothing.
 */
export const customerPolicy = {
  viewAny(user: User) {
    return user.unitId !== null
  },

  view(user: User, customer: Customer) {
    return user.unitId !== null && customer.unitId === user.unitId
  },

  create(user: User) {
    return user.unitId !== null && user.isManager
  },

  update(user: User, customer: Customer) {
    return this.view(user, customer) && user.isManager
  },

  delete(user: User, customer: Customer) {
    return this.update(user, customer)
  },
}
