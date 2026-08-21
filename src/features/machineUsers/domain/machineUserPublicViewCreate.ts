import type { MachineUserRow } from "../persistence/machineUserTable.js"
import type { MachineUser } from "../public/machineUserSchema.js"

export function machineUserPublicViewCreate(row: MachineUserRow, scopes: readonly string[]): MachineUser {
  return {
    createdAt: row.createdAt,
    displayName: row.displayName,
    id: row.id,
    realmId: row.realmId,
    scopes: [...scopes],
    status: row.status as MachineUser["status"],
    updatedAt: row.updatedAt,
    userName: row.userName,
  }
}
