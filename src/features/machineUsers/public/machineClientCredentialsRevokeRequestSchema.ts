import * as v from "valibot"

export const machineClientCredentialsRevokeRequestSchema = v.strictObject({
  clientId: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  clientSecret: v.pipe(v.string(), v.minLength(1), v.maxLength(512)),
  token: v.pipe(v.string(), v.minLength(1), v.maxLength(512)),
})

export type MachineClientCredentialsRevokeRequest = v.InferOutput<typeof machineClientCredentialsRevokeRequestSchema>
