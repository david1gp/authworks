import type { MfaPolicy } from "../public/mfaPolicySchema.js"
import type { MfaPolicyRow } from "../persistence/mfaPolicyTable.js"

export function mfaPolicyViewCreate(row: MfaPolicyRow): MfaPolicy {
  return {
    lockoutDurationMs: row.lockoutDurationMs,
    maxAttempts: row.maxAttempts,
    mode: row.mode as MfaPolicy["mode"],
    totpWindow: row.totpWindow,
  }
}
