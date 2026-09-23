import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import app from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'
import { createResourceController } from '@adula/kit'
import type { Actor, ResourceDescription } from '@adula/kit'
import { kit, requestActor } from '#services/kit'
import { testFixturesEnabled } from '#start/test_fixtures'
const fixtureRenderers = testFixturesEnabled ? await import('#tests/fixtures/presentation') : null

type Mode = 'index' | 'form' | 'show'
const modes: Mode[] = ['index', 'form', 'show']

/**
 * Presence of `inertia/pages/<resource>/<mode>.tsx` replaces the generated page.
 * Scanned once at boot: sources in development, the Vite manifest in production builds.
 */
function discoverPageOverrides() {
  const found = new Set<string>()
  const roots = [app.makePath('inertia/pages')]
  if (testFixturesEnabled) roots.push(app.makePath('tests/fixtures/frontend/pages'))
  for (const pages of roots) {
    if (!existsSync(pages)) continue
    for (const entry of readdirSync(pages, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      for (const mode of modes)
        if (existsSync(join(pages, entry.name, `${mode}.tsx`))) found.add(`${entry.name}/${mode}`)
    }
  }
  if (roots.some((path) => existsSync(path))) return found
  const manifest = app.publicPath('assets/.vite/manifest.json')
  if (!existsSync(manifest)) return found
  for (const key of Object.keys(JSON.parse(readFileSync(manifest, 'utf8')))) {
    const match = /^inertia\/pages\/([^/]+)\/(index|form|show)\.tsx$/.exec(key)
    if (match) found.add(`${match[1]}/${match[2]}`)
  }
  return found
}
const overrides = discoverPageOverrides()
export function pageFor(resource: string, mode: Mode) {
  return overrides.has(`${resource}/${mode}`) ? `${resource}/${mode}` : 'resources/page'
}
/** Override pages receive the generic payload; the cast only widens the page name resolved at boot. */
const generic = (page: string) => page as 'resources/page'

async function actorOf(ctx: HttpContext) {
  return requestActor(ctx)
}

function childDescriptions(description: ResourceDescription, actor: Actor) {
  const children: Record<string, ResourceDescription> = {}
  for (const field of description.fields) {
    if (field.type !== 'hasMany') continue
    try {
      children[field.key] = kit().resources.describe(field.resource, actor)
    } catch {
      // A child the actor cannot view is omitted; the deferred rows are authorized separately.
    }
  }
  return children
}

export default createResourceController(
  async (ctx) => {
    const runtime = kit()
    return { ...runtime, actor: await requestActor(ctx) }
  },
  async (ctx, resource, result) => {
    const runtime = kit()
    const actor = await actorOf(ctx)
    const page = pageFor(resource.name, 'index')
    const custom = await fixtureRenderers?.index(ctx, page, runtime, actor, result)
    if (custom !== undefined) return custom
    return ctx.inertia.render(generic(page), {
      view: async () => ({
        mode: 'index' as const,
        resource: runtime.resources.describe(resource.name, actor),
        lookups: await runtime.resources.lookups(resource.name, actor),
        savedViews: await runtime.savedViews.list(resource.name, actor),
      }),
      result: ctx.inertia
        .scroll(result, (value) => ({
          pageName: 'cursor',
          currentPage: (ctx.request.input('cursor') as string | undefined) ?? null,
          nextPage: value.meta.nextCursor,
          previousPage: null,
        }))
        .matchOn('id'),
    })
  },
  async (ctx, resource, editor) => {
    const page = pageFor(resource.name, 'form')
    const custom = await fixtureRenderers?.form(ctx, page, editor)
    if (custom !== undefined) return custom
    const actor = await actorOf(ctx)
    const shown = editor.record
      ? await kit().resources.show(resource.name, Number(editor.record.id), actor)
      : null
    const permissions = shown ? shown.permissions : {}
    return ctx.inertia.render(generic(page), {
      view: { mode: 'form', editor, permissions },
    })
  },
  async (ctx, resource, result) => {
    const runtime = kit()
    const actor = await actorOf(ctx)
    const id = Number(result.data.id)
    const description = runtime.resources.describe(resource.name, actor)
    return ctx.inertia.render(generic(pageFor(resource.name, 'show')), {
      view: async () => ({
        mode: 'show' as const,
        resource: description,
        result,
        lookups: await runtime.resources.lookups(resource.name, actor),
        childResources: childDescriptions(description, actor),
      }),
      childrenData: ctx.inertia.defer(
        () => runtime.resources.children(resource.name, id, actor),
        'children'
      ),
      activity: ctx.inertia.defer(
        () => runtime.resources.activity(resource.name, id, actor),
        'activity'
      ),
    })
  }
)
