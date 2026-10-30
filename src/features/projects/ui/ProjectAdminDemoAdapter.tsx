import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
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
      <h1 class="sr-only">{messageTranslate("demo.admin.scenario.projects.title")}</h1>
      <ProjectAdminScreenView state={state} />
    </div>
  )
}
