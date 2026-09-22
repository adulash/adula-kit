import type { ReactElement } from 'react'
import { ResourcePage, type ResourcePageProps } from '~/components/ui/resource-page'
import Workspace from '~/layouts/workspace'

// Inertia's page discovery applies Omit to top-level props; the discriminated union stays under `view`.
export default function Page(props: ResourcePageProps) {
  return <ResourcePage {...props} />
}
Page.layout = (page: ReactElement) => <Workspace>{page}</Workspace>
