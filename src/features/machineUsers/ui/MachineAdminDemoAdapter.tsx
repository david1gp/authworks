import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { DemoFixtureStateSelector } from "../../demo/ui/DemoFixtureStateSelector.js"
import { MachineAdminScreenView } from "./MachineAdminScreenView.js"
import { machineAdminDemoStateCreate } from "./machineAdminDemoStateCreate.js"
import type { MachineAdminScreen } from "./machineAdminScreenSchema.js"

export function MachineAdminDemoAdapter(props: {
  readonly machineUserId?: string
  readonly screen: MachineAdminScreen
}) {
  const state = machineAdminDemoStateCreate({
    machineUserId: () => props.machineUserId,
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
      <MachineAdminScreenView state={state} />
    </div>
  )
}
