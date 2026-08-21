import * as v from "valibot"

export const machineAdminScreenSchema = v.picklist(["machine-users", "machine-user-detail", "machine-credentials"])

export type MachineAdminScreen = v.InferOutput<typeof machineAdminScreenSchema>
