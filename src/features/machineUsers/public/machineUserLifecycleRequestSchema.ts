import * as v from "valibot"
import { machineUserStatusSchema } from "../domain/machineUserStatusSchema.js"

export const machineUserLifecycleRequestSchema = v.strictObject({ status: machineUserStatusSchema })

export type MachineUserLifecycleRequest = v.InferOutput<typeof machineUserLifecycleRequestSchema>
