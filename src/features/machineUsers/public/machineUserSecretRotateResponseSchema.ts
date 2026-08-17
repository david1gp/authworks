import * as v from "valibot"
import { machineUserSchema } from "./machineUserSchema.js"

export const machineUserSecretRotateResponseSchema = v.strictObject({
  clientId: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  clientSecret: v.pipe(v.string(), v.minLength(43)),
  machineUser: machineUserSchema,
})

export type MachineUserSecretRotateResponse = v.InferOutput<typeof machineUserSecretRotateResponseSchema>
