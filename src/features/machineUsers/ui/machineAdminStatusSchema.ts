import * as v from "valibot"

export const machineAdminStatusSchema = v.picklist([
  "loading",
  "ready",
  "empty",
  "error",
  "permission-denied",
  "assurance-required",
  "cross-tenant",
])

export type MachineAdminStatus = v.InferOutput<typeof machineAdminStatusSchema>
