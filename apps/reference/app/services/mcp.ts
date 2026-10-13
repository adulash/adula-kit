import type { HttpContext } from '@adonisjs/core/http'
import { createResourceTools } from 'adula/mcp'
import { AdulaError } from 'adula'
import { adula } from '#services/adula'

declare module '@jrmc/adonis-mcp/types/context' {
  interface McpContext {
    auth?: HttpContext['auth']
  }
}

export const resourceTools = createResourceTools(async (context) => {
  const user = context.auth?.user
  if (!user) throw new AdulaError(401, 'E_UNAUTHORIZED', 'سجل الدخول أولاً')
  const runtime = adula()
  return { ...runtime, actor: await runtime.actors.load(user.id) }
})
