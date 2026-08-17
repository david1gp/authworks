import type { MachineCredentialRow } from "../persistence/machineCredentialTable.js"
import type { MachineCredential } from "../public/machineCredentialSchema.js"

export function machineCredentialPublicViewCreate(
  row: MachineCredentialRow,
  scopes: readonly string[],
): MachineCredential {
  return {
    createdAt: row.createdAt,
    ...(row.expiresAt === null ? {} : { expiresAt: row.expiresAt }),
    id: row.id,
    instanceId: row.instanceId,
    kind: row.kind as MachineCredential["kind"],
    machineUserId: row.machineUserId,
    ...(row.name === null ? {} : { name: row.name }),
    ...(row.revokedAt === null ? {} : { revokedAt: row.revokedAt }),
    scopes: [...scopes],
  }
}
