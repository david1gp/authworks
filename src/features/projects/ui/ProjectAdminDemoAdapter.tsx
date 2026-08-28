import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
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
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <AuthenticatedPageHeader
        description={state.scenarioDescription()}
        eyebrow={messageTranslate("demo.fixture.preview")}
        meta={
          <>
            <span class="text-2xs font-semibold uppercase tracking-[0.12em]">
              {messageTranslate("demo.fixture.state")}
            </span>
            <DemoFixtureStateSelector options={state.stateOptions()} />
          </>
        }
        title={state.scenarioTitle()}
      />
      <ProjectAdminScreenView state={state} />
    </div>
  )
}
