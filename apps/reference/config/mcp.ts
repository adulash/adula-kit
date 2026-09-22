import { defineConfig } from '@jrmc/adonis-mcp'

export default defineConfig({
  name: 'adula-reference',
  version: '0.1.0',
  cache: { tools: { ttlMs: 0, scope: 'private' } },
})
