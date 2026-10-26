import * as v from "valibot"

export const machineClientCredentialsRevokeResponseSchema = v.strictObject({
  revoked: v.literal(true),
})

export type MachineClientCredentialsRevokeResponse = v.InferOutput<typeof machineClientCredentialsRevokeResponseSchema>
