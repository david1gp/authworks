import * as v from "valibot"
import { machineCredentialKindSchema } from "../public/machineCredentialKindSchema.js"
import { machineScopeSchema } from "../public/machineScopeSchema.js"

export const machineCredentialIssuedEventPayloadSchema = v.strictObject({
  credentialId: v.pipe(v.string(), v.minLength(1)),
  credentialKind: machineCredentialKindSchema,
  expiresAt: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  machineUserId: v.pipe(v.string(), v.minLength(1)),
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
  scopes: v.pipe(v.array(machineScopeSchema), v.maxLength(100)),
})

export type MachineCredentialIssuedEventPayload = v.InferOutput<typeof machineCredentialIssuedEventPayloadSchema>
