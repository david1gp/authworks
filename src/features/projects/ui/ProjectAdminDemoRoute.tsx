import { useParams } from "@solidjs/router"
import { ProjectAdminDemoAdapter } from "./ProjectAdminDemoAdapter.js"
import type { ProjectAdminScreen } from "./projectAdminScreenSchema.js"

/** Binds a `/demo/admin/**` route to a project administration screen. */
export function ProjectAdminDemoRoute(props: {
  readonly fallbackProjectId?: string
  readonly screen: ProjectAdminScreen
}) {
  const params = useParams<{ projectId?: string }>()
  return <ProjectAdminDemoAdapter projectId={params.projectId ?? props.fallbackProjectId} screen={props.screen} />
}
