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
    <div class="mx-auto grid min-w-0 max-w-6xl gap-6">
      <DemoFixtureStateSelector options={state.stateOptions()} />
      <MachineAdminScreenView state={state} />
    </div>
  )
}
