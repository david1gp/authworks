import * as v from "valibot"
import { machineUserSchema } from "./machineUserSchema.js"

export const machineUserResponseSchema = v.strictObject({ machineUser: machineUserSchema })

export type MachineUserResponse = v.InferOutput<typeof machineUserResponseSchema>
