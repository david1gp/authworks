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
      <h1 class="sr-only">{state.scenarioTitle()}</h1>
      <MachineAdminScreenView state={state} />
    </div>
  )
}
