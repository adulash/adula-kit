import type { Listener } from '@adula/kit'
import { testFixturesEnabled } from '#start/test_fixtures'
export const listeners: Listener[] = []
if (testFixturesEnabled) {
  const { orderSubmitted } = await import('#tests/fixtures/modules/tasks/listeners/order_submitted')
  listeners.push(orderSubmitted)
}
