import type { MachineCredential } from "../public/machineCredentialSchema.js"

export type MachineCredentialState = "active" | "expired" | "revoked"

/**
 * Derives the effective state of a credential. Revocation wins over expiry so a credential
 * that was deliberately revoked is never presented as merely lapsed.
 */
export function machineCredentialStateSelect(credential: MachineCredential, now: number): MachineCredentialState {
  if (credential.revokedAt !== undefined) return "revoked"
  if (credential.expiresAt !== undefined && credential.expiresAt <= now) return "expired"
  return "active"
}
