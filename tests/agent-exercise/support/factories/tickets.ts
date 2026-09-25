import factory from '@adonisjs/lucid/factories'
import Model from '#modules/support/models/tickets'
export default factory
  .define(Model, ({ faker }) => ({ subject: faker.lorem.words(3), priority: 'normal' }))
  .build()
