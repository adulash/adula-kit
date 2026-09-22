import env from '#start/env'

// Test resources must never become application modules through a preview flag.
export const testFixturesEnabled = env.get('NODE_ENV') === 'test'
if (testFixturesEnabled && !env.get('DB_DATABASE').endsWith('_test')) {
  throw new Error('Reference fixtures require a dedicated *_test database')
}
