import * as v from "valibot"
import { machineUserSchema } from "./machineUserSchema.js"

export const machineUserListResponseSchema = v.strictObject({ machineUsers: v.array(machineUserSchema) })

export type MachineUserListResponse = v.InferOutput<typeof machineUserListResponseSchema>
