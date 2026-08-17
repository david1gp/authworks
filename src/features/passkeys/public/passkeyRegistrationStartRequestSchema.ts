import * as v from "valibot"

export const passkeyRegistrationStartRequestSchema = v.strictObject({})

export type PasskeyRegistrationStartRequest = v.InferOutput<typeof passkeyRegistrationStartRequestSchema>
