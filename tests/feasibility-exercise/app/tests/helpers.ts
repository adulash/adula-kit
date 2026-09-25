import Unit from '#models/unit'
import User, { type UserRole } from '#models/user'
import Customer from '#models/customer'

let sequence = 0

export async function makeUnit(name?: string) {
  sequence++
  return Unit.create({ name: name ?? `وحدة ${sequence}` })
}

export async function makeUser(role: UserRole, unit: Unit | null) {
  sequence++
  return User.create({
    email: `${role}.${sequence}@example.test`,
    fullName: `${role} ${sequence}`,
    password: 'password123',
    role,
    unitId: unit?.id ?? null,
  })
}

export async function makeCustomer(unit: Unit, values: Partial<Customer> = {}) {
  sequence++
  return Customer.create({ name: `عميل ${sequence}`, unitId: unit.id, ...values })
}

/**
 * Two units, each with a manager and an employee.
 */
export async function makeWorld() {
  const unitA = await makeUnit('الوحدة أ')
  const unitB = await makeUnit('الوحدة ب')
  return {
    unitA,
    unitB,
    managerA: await makeUser('manager', unitA),
    employeeA: await makeUser('employee', unitA),
    managerB: await makeUser('manager', unitB),
    employeeB: await makeUser('employee', unitB),
  }
}

/**
 * Validation errors flashed to the session by a failed form submission.
 */
export function inputErrors(response: { flashMessages(): Record<string, unknown> }) {
  return (response.flashMessages().inputErrorsBag ?? {}) as Record<string, string[]>
}
