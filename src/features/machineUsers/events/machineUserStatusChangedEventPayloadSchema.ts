import * as v from "valibot"
import { machineUserStatusSchema } from "../domain/machineUserStatusSchema.js"

export const machineUserStatusChangedEventPayloadSchema = v.strictObject({ status: machineUserStatusSchema })

export type MachineUserStatusChangedEventPayload = v.InferOutput<typeof machineUserStatusChangedEventPayloadSchema>
