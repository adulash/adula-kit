import { followerListeners, workflowListeners, type Listener } from 'adula'
import { testFixturesEnabled } from '#start/test_fixtures'
import { registry } from '#start/modules'
import { adula } from '#services/adula'

export const listeners: Listener[] = [
  ...followerListeners(registry, () => adula().collaboration),
  ...workflowListeners(registry, () => adula().workflows),
  {
    name: 'adula.webhooks',
    event: '*',
    handle: (event, trx) => adula().webhooks.listener().handle(event, trx),
  },
]
if (testFixturesEnabled) {
  const { orderSubmitted } = await import('#tests/fixtures/modules/tasks/listeners/order_submitted')
  listeners.push(orderSubmitted)
}
