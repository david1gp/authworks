import { ProjectAdminScreenView } from "./ProjectAdminScreenView.js"
import { projectAdminProductionStateCreate } from "./projectAdminProductionStateCreate.js"
import type { ProjectAdminScreen } from "./projectAdminScreenSchema.js"

export function ProjectAdminProductionAdapter(props: {
  readonly projectId?: string
  readonly screen: ProjectAdminScreen
}) {
  const state = projectAdminProductionStateCreate({
    projectId: () => props.projectId,
    screen: () => props.screen,
  })
  return <ProjectAdminScreenView state={state} />
}
