import { ProjectAdminScreenView } from "./ProjectAdminScreenView.js"
import { projectAdminDemoStateCreate } from "./projectAdminDemoStateCreate.js"
import type { ProjectAdminScreen } from "./projectAdminScreenSchema.js"

export function ProjectAdminDemoAdapter(props: { readonly projectId?: string; readonly screen: ProjectAdminScreen }) {
  const state = projectAdminDemoStateCreate({
    projectId: () => props.projectId,
    screen: () => props.screen,
  })
  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <ProjectAdminScreenView state={state} />
    </div>
  )
}
