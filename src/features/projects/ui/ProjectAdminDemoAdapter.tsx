import { DemoFixtureStateSelector } from "../../demo/ui/DemoFixtureStateSelector.js"
import { ProjectAdminScreenView } from "./ProjectAdminScreenView.js"
import { projectAdminDemoStateCreate } from "./projectAdminDemoStateCreate.js"
import type { ProjectAdminScreen } from "./projectAdminScreenSchema.js"

export function ProjectAdminDemoAdapter(props: { readonly projectId?: string; readonly screen: ProjectAdminScreen }) {
  const state = projectAdminDemoStateCreate({
    projectId: () => props.projectId,
    screen: () => props.screen,
  })
  return (
    <div class="mx-auto grid min-w-0 max-w-6xl gap-6">
      <DemoFixtureStateSelector options={state.stateOptions()} />
      <ProjectAdminScreenView state={state} />
    </div>
  )
}
