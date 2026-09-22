import type { ResolvedComponent } from '@inertiajs/react'

// Vite substitutes the test-only loader in test mode. Production has no example pages.
export default {} as Record<string, () => Promise<ResolvedComponent>>
