import * as v from "valibot"

export const machineCredentialRevokeRequestSchema = v.strictObject({
  reason: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
})

export type MachineCredentialRevokeRequest = v.InferOutput<typeof machineCredentialRevokeRequestSchema>
