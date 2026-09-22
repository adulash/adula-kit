import env from '#start/env'
import { defineConfig, services } from '@adonisjs/ally'

/**
 * Providers are always declared so their types exist; a provider is offered
 * to users only when its credentials are configured (see start/routes.ts).
 */
const allyConfig = defineConfig({
  github: services.github({
    clientId: env.get('GITHUB_CLIENT_ID') ?? '',
    clientSecret: env.get('GITHUB_CLIENT_SECRET') ?? '',
    callbackUrl: `${env.get('APP_URL')}/oauth/github/callback`,
  }),
  google: services.google({
    clientId: env.get('GOOGLE_CLIENT_ID') ?? '',
    clientSecret: env.get('GOOGLE_CLIENT_SECRET') ?? '',
    callbackUrl: `${env.get('APP_URL')}/oauth/google/callback`,
  }),
})

export default allyConfig

declare module '@adonisjs/ally/types' {
  interface SocialProviders extends InferSocialProviders<typeof allyConfig> {}
}
