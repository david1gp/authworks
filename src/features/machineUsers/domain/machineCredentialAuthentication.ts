import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import type { MachineCredential } from "../public/machineCredentialSchema.js"
import type { MachineUser } from "../public/machineUserSchema.js"

export type MachineCredentialAuthentication = {
  readonly actor: AuthorizationActorContext
  readonly credential: MachineCredential
  readonly machineUser: MachineUser
  readonly scopes: string[]
}
