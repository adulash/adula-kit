/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  home: typeof routes['home']
  session: {
    create: typeof routes['session.create']
    store: typeof routes['session.store']
    destroy: typeof routes['session.destroy']
  }
  customers: {
    index: typeof routes['customers.index']
    create: typeof routes['customers.create']
    store: typeof routes['customers.store']
    show: typeof routes['customers.show']
    edit: typeof routes['customers.edit']
    update: typeof routes['customers.update']
    destroy: typeof routes['customers.destroy']
  }
}
