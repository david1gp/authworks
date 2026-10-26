import * as v from "valibot"
import { machineScopeSchema } from "./machineScopeSchema.js"

export const machineUserUpdateRequestSchema = v.strictObject({
  displayName: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  scopes: v.optional(v.pipe(v.array(machineScopeSchema), v.maxLength(100))),
})

export type MachineUserUpdateRequest = v.InferOutput<typeof machineUserUpdateRequestSchema>
