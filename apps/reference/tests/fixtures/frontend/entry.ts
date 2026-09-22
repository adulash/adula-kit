/// <reference types="vite/client" />
import type { ResolvedComponent } from '@inertiajs/react'
export default import.meta.glob<ResolvedComponent>('./pages/**/*.tsx')
