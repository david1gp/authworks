import * as v from "valibot"
import { machineUserStatusSchema } from "../public/machineUserStatusSchema.js"

export const machineUserStatusChangedEventPayloadSchema = v.strictObject({ status: machineUserStatusSchema })

export type MachineUserStatusChangedEventPayload = v.InferOutput<typeof machineUserStatusChangedEventPayloadSchema>
