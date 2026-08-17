import * as v from "valibot"
import { machineScopeSchema } from "../domain/machineScopeSchema.js"

export const machineUserCreateRequestSchema = v.strictObject({
  displayName: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  scopes: v.optional(v.pipe(v.array(machineScopeSchema), v.maxLength(100))),
  userName: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
})

export type MachineUserCreateRequest = v.InferOutput<typeof machineUserCreateRequestSchema>
