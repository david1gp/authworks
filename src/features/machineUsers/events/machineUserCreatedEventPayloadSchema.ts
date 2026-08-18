import * as v from "valibot"
import { machineScopeSchema } from "../public/machineScopeSchema.js"
import { machineUserStatusSchema } from "../public/machineUserStatusSchema.js"

export const machineUserCreatedEventPayloadSchema = v.strictObject({
  displayName: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  scopes: v.pipe(v.array(machineScopeSchema), v.maxLength(100)),
  status: machineUserStatusSchema,
  userName: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
})

export type MachineUserCreatedEventPayload = v.InferOutput<typeof machineUserCreatedEventPayloadSchema>
