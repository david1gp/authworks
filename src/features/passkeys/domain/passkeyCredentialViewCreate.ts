import type { PasskeyCredentialRow } from "../persistence/passkeyCredentialTable.js"
import type { PasskeyCredential } from "../public/passkeyCredentialSchema.js"

export function passkeyCredentialViewCreate(row: PasskeyCredentialRow): PasskeyCredential {
  let transports: PasskeyCredential["transports"] = []
  try {
    const parsed = JSON.parse(row.transports)
    if (Array.isArray(parsed)) transports = parsed as PasskeyCredential["transports"]
  } catch (_error) {
    transports = []
  }
  return {
    aaguid: row.aaguid,
    backedUp: row.backedUp === 1,
    createdAt: row.createdAt,
    deviceType: row.deviceType as PasskeyCredential["deviceType"],
    id: row.id,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    transports,
  }
}
