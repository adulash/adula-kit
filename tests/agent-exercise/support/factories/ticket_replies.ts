import factory from '@adonisjs/lucid/factories'
import Model from '#modules/support/models/ticket_replies'
export default factory.define(Model, ({ faker }) => ({ body: faker.lorem.sentence() })).build()
