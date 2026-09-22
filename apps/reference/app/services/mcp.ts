import type { HttpContext } from '@adonisjs/core/http'
import { createResourceTools } from '@adula/kit/mcp'
import { KitError } from '@adula/kit'
import { kit } from '#services/kit'

declare module '@jrmc/adonis-mcp/types/context' {
  interface McpContext {
    auth?: HttpContext['auth']
  }
}

export const resourceTools = createResourceTools(async (context) => {
  const user = context.auth?.user
  if (!user) throw new KitError(401, 'E_UNAUTHORIZED', 'سجل الدخول أولاً')
  const runtime = kit()
  return { ...runtime, actor: await runtime.actors.load(user.id) }
})
