import type { MachineCredentialKind } from "../public/machineCredentialKindSchema.js"

/**
 * A credential value shown exactly once. It is held in view memory only and is never
 * persisted, logged, placed in a URL, or re-fetchable after acknowledgement.
 */
export type MachineAdminIssuedSecret = {
  /** Present only for a client-credentials pair, where the identifier is needed alongside the secret. */
  readonly clientId?: string
  readonly kind: MachineCredentialKind
  /** Identifies the owning service identity so an acknowledgement marker stays per machine user. */
  readonly machineUserId: string
  readonly machineUserName: string
  readonly name: string
  readonly secret: string
}
