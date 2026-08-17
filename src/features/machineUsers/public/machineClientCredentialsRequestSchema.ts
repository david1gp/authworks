import * as v from "valibot"
import { machineScopeSchema } from "../domain/machineScopeSchema.js"

export const machineClientCredentialsRequestSchema = v.strictObject({
  clientId: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  clientSecret: v.pipe(v.string(), v.minLength(1), v.maxLength(512)),
  scope: v.optional(v.pipe(v.array(machineScopeSchema), v.maxLength(100))),
})

export type MachineClientCredentialsRequest = v.InferOutput<typeof machineClientCredentialsRequestSchema>
