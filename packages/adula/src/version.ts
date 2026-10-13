import { createRequire } from 'node:module'
export const ADULA_VERSION: string = createRequire(import.meta.url)('adula/package.json').version
