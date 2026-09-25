import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Unit from '#models/unit'
import User from '#models/user'
import Customer from '#models/customer'

/**
 * Development data only: two units, one manager and one employee per unit.
 * Password for every account: password123
 */
export default class extends BaseSeeder {
  async run() {
    const [north, south] = await Unit.updateOrCreateMany('name', [
      { name: 'الوحدة الشمالية' },
      { name: 'الوحدة الجنوبية' },
    ])

    const users = [
      {
        email: 'manager.north@example.test',
        fullName: 'مدير الشمال',
        role: 'manager',
        unitId: north.id,
      },
      {
        email: 'employee.north@example.test',
        fullName: 'موظف الشمال',
        role: 'employee',
        unitId: north.id,
      },
      {
        email: 'manager.south@example.test',
        fullName: 'مدير الجنوب',
        role: 'manager',
        unitId: south.id,
      },
      {
        email: 'employee.south@example.test',
        fullName: 'موظف الجنوب',
        role: 'employee',
        unitId: south.id,
      },
    ] as const
    for (const u of users) {
      await User.updateOrCreate({ email: u.email }, { ...u, password: 'password123' })
    }

    const existing = await Customer.query().count('* as total').first()
    if (Number(existing?.$extras.total ?? 0) === 0) {
      await Customer.createMany([
        {
          unitId: north.id,
          name: 'شركة النور للتجارة',
          email: 'info@alnoor.example',
          phone: '0501234567',
        },
        { unitId: north.id, name: 'مؤسسة الأفق', phone: '0559876543', address: 'الرياض' },
        { unitId: south.id, name: 'شركة الجنوب المتحدة', email: 'sales@south.example' },
      ])
    }
  }
}
