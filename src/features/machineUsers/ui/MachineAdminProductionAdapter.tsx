import { MachineAdminScreenView } from "./MachineAdminScreenView.js"
import { machineAdminProductionStateCreate } from "./machineAdminProductionStateCreate.js"
import type { MachineAdminScreen } from "./machineAdminScreenSchema.js"

export function MachineAdminProductionAdapter(props: {
  readonly machineUserId?: string
  readonly screen: MachineAdminScreen
}) {
  const state = machineAdminProductionStateCreate({
    machineUserId: () => props.machineUserId,
    screen: () => props.screen,
  })
  return <MachineAdminScreenView state={state} />
}
