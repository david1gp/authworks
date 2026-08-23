import type { MachineUser } from "../public/machineUserSchema.js"
import type { MachineAdminIssuedSecret } from "./machineAdminIssuedSecret.js"

/**
 * Chooses which machine user a directly linked one-time demo secret belongs to. A machine-user
 * detail or credentials deep link seeds that user, so the panel never shows another user's
 * identity, and an unknown identifier seeds nothing at all.
 */
export function machineAdminDemoIssuedSecretSeedSelect(options: {
  readonly machineUserId: string | undefined
  readonly machineUsers: readonly MachineUser[]
  readonly secret: string
}): MachineAdminIssuedSecret | undefined {
  const selected =
    options.machineUserId === undefined
      ? options.machineUsers[0]
      : options.machineUsers.find((item) => item.id === options.machineUserId)
  if (selected === undefined) return undefined
  return {
    clientId: selected.userName,
    kind: "client_secret",
    machineUserId: selected.id,
    machineUserName: selected.displayName,
    name: selected.displayName,
    secret: options.secret,
  }
}
