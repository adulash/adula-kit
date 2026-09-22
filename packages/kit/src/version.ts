import { createRequire } from 'node:module'
export const KIT_VERSION: string = createRequire(import.meta.url)('@adula/kit/package.json').version
