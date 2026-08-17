import * as v from "valibot"

export const machineUserStatusSchema = v.picklist(["active", "inactive", "removed"])

export type MachineUserStatus = v.InferOutput<typeof machineUserStatusSchema>
