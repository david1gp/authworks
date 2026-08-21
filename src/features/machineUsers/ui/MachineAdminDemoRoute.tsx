import { useParams } from "@solidjs/router"
import { MachineAdminDemoAdapter } from "./MachineAdminDemoAdapter.js"
import type { MachineAdminScreen } from "./machineAdminScreenSchema.js"

/** Binds a `/demo/admin/**` route to a machine-user administration screen. */
export function MachineAdminDemoRoute(props: { readonly screen: MachineAdminScreen }) {
  const params = useParams<{ machineUserId?: string }>()
  return <MachineAdminDemoAdapter machineUserId={params.machineUserId} screen={props.screen} />
}
