import * as v from "valibot"

export const machineClientCredentialsResponseSchema = v.strictObject({
  accessToken: v.pipe(v.string(), v.minLength(43)),
  expiresIn: v.pipe(v.number(), v.integer(), v.minValue(1)),
  scope: v.string(),
  tokenType: v.literal("Bearer"),
})

export type MachineClientCredentialsResponse = v.InferOutput<typeof machineClientCredentialsResponseSchema>
