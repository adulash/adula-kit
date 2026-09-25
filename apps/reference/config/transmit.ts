import { defineConfig } from '@adonisjs/transmit'

/**
 * Each web process LISTENs for committed notifications in PostgreSQL itself
 * (start/realtime.ts), so no cross-instance transport is needed.
 */
export default defineConfig({
  pingInterval: '30s',
  transport: null,
})
