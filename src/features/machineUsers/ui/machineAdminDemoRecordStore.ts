import { demoAdminMachineCredentials } from "../../demo/demoAdminMachineCredentials.js"
import { demoAdminMachineUsers } from "../../demo/demoAdminMachineUsers.js"
import type { MachineCredential } from "../public/machineCredentialSchema.js"
import type { MachineUser } from "../public/machineUserSchema.js"

/**
 * The mutable machine-user records a demo browsing session works on. Navigating between the
 * directory, a detail route, and the credential overview recreates the adapter, so the records
 * must outlive a single adapter instance: otherwise a machine user created in the directory has
 * no detail route and an issued credential disappears from its list. Nothing here is persisted,
 * so a reload returns to the deterministic fixtures.
 */
const credentials: MachineCredential[] = []
const machineUsers: MachineUser[] = []

export const machineAdminDemoRecordStore = {
  credentials,
  machineUsers,
  /**
   * Restores the authored fixtures in place, so a demo session returns to a known state without
   * invalidating the array references an already-created adapter holds.
   */
  reset: () => {
    credentials.splice(0, credentials.length, ...demoAdminMachineCredentials.map((item) => ({ ...item })))
    machineUsers.splice(0, machineUsers.length, ...demoAdminMachineUsers.map((item) => ({ ...item })))
  },
}

machineAdminDemoRecordStore.reset()
