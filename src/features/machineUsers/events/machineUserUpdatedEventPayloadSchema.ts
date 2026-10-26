import * as v from "valibot"
import { machineScopeSchema } from "../public/machineScopeSchema.js"

export const machineUserUpdatedEventPayloadSchema = v.strictObject({
  displayName: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  scopes: v.pipe(v.array(machineScopeSchema), v.maxLength(100)),
})

export type MachineUserUpdatedEventPayload = v.InferOutput<typeof machineUserUpdatedEventPayloadSchema>
