/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
*/

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'

router.on('/').renderInertia('home', {}).as('home')

router
  .group(() => {
    router.get('login', [controllers.Session, 'create'])
    router.post('login', [controllers.Session, 'store'])
  })
  .use(middleware.guest())

router
  .group(() => {
    router.post('logout', [controllers.Session, 'destroy'])

    router.get('customers', [controllers.Customers, 'index']).as('customers.index')
    router.get('customers/create', [controllers.Customers, 'create']).as('customers.create')
    router.post('customers', [controllers.Customers, 'store']).as('customers.store')
    router.get('customers/:id', [controllers.Customers, 'show']).as('customers.show')
    router.get('customers/:id/edit', [controllers.Customers, 'edit']).as('customers.edit')
    router.put('customers/:id', [controllers.Customers, 'update']).as('customers.update')
    router.delete('customers/:id', [controllers.Customers, 'destroy']).as('customers.destroy')
  })
  .use(middleware.auth())
