import type { ReactNode } from 'react'
import type { Action, RecordPermissions } from '@adula/kit'

/** CASL is evaluated server-side before redaction; hidden condition fields stay private. */
export function Can({ permissions, action, children }: {
  permissions: RecordPermissions; action: Action; children: ReactNode
}) {
  return permissions[action] ? children : null
}
