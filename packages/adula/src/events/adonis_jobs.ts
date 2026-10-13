import type { Jobs } from './outbox.js'

/** Adapt an application's adonis-jobs dispatcher without importing its job classes. */
export class AdonisJobs implements Jobs {
  constructor(
    private dispatchers: Record<
      string,
      (payload: Record<string, unknown>, id: string) => Promise<unknown>
    >
  ) {}

  async dispatch(name: string, payload: Record<string, unknown>, options: { id: string }) {
    const dispatch = this.dispatchers[name]
    if (!dispatch) throw new Error(`No job dispatcher registered for ${name}`)
    await dispatch(payload, options.id)
  }
}
