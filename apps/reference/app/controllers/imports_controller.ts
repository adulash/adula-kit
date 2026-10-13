import { readFile } from 'node:fs/promises'
import type { HttpContext } from '@adonisjs/core/http'
import { AdulaError } from 'adula'
import { adula, requestActor } from '#services/adula'
import { wantsJson } from '#controllers/admin/support'

/** CSV import batches owned by the signed-in user. */
export default class ImportsController {
  async index(ctx: HttpContext) {
    const batches = await adula().imports.list(await requestActor(ctx))
    if (wantsJson(ctx)) return { data: batches }
    return ctx.inertia.render('work/imports', { batches })
  }

  async store(ctx: HttpContext) {
    const actor = await requestActor(ctx)
    let name: string
    try {
      name = adula().registry.get(ctx.params.resource).name
    } catch {
      throw new AdulaError(404, 'E_NOT_FOUND', 'الكيان غير موجود')
    }
    // Authorize before reading the upload.
    adula().imports.targets(name, actor)
    const file = ctx.request.file('file', { size: '5mb', extnames: ['csv', 'txt'] })
    if (!file || !file.isValid || !file.tmpPath)
      throw new AdulaError(422, 'E_IMPORT_FILE', file?.errors[0]?.message ?? 'اختر ملف CSV')
    const batch = await adula().imports.create(name, actor, {
      fileName: file.clientName,
      content: await readFile(file.tmpPath, 'utf8'),
    })
    return ctx.response.created({ data: batch })
  }

  async show(ctx: HttpContext) {
    return { data: await adula().imports.show(ctx.params.id, await requestActor(ctx)) }
  }

  async start(ctx: HttpContext) {
    return {
      data: await adula().imports.start(
        ctx.params.id,
        await requestActor(ctx),
        ctx.request.input('mapping')
      ),
    }
  }
}
