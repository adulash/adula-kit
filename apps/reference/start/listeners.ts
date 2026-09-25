import { followerListeners, workflowListeners, type Listener } from '@adula/kit'
import { testFixturesEnabled } from '#start/test_fixtures'
import { registry } from '#start/modules'
import { kit } from '#services/kit'

export const listeners: Listener[] = [
  ...followerListeners(registry, () => kit().collaboration),
  ...workflowListeners(registry, () => kit().workflows),
  {
    name: 'kit.webhooks',
    event: '*',
    handle: (event, trx) => kit().webhooks.listener().handle(event, trx),
  },
]
if (testFixturesEnabled) {
  const { orderSubmitted } = await import('#tests/fixtures/modules/tasks/listeners/order_submitted')
  listeners.push(orderSubmitted)
}
