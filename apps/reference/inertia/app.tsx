import { type ReactElement } from 'react'
import { client } from './client'
import Layout from '~/layouts/default'
import { type Data } from '@generated/data'
import { createRoot } from 'react-dom/client'
import { createInertiaApp, type ResolvedComponent } from '@inertiajs/react'
import { TuyauProvider } from '@adonisjs/inertia/react'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'
import fixturePages from '~/fixture_pages'
import './css/kit.css'

const appName = import.meta.env.VITE_APP_NAME || 'adula kit'

createInertiaApp({
  title: (title) => (title ? `${title} - ${appName}` : appName),
  resolve: (name) => {
    return resolvePageComponent<ResolvedComponent>(
      `./pages/${name}.tsx`,
      { ...import.meta.glob<ResolvedComponent>('./pages/**/*.tsx'), ...fixturePages },
      (page: ReactElement<Data.SharedProps>) => <Layout children={page} />
    )
  },
  setup({ el, App, props }) {
    createRoot(el).render(
      <TuyauProvider client={client}>
        <App {...props} />
      </TuyauProvider>
    )
  },
  progress: {
    color: '#4B5563',
  },
})
