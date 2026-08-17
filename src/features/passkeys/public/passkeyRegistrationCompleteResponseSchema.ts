import * as v from "valibot"
import { passkeyCredentialSchema } from "./passkeyCredentialSchema.js"

export const passkeyRegistrationCompleteResponseSchema = v.strictObject({ credential: passkeyCredentialSchema })

export type PasskeyRegistrationCompleteResponse = v.InferOutput<typeof passkeyRegistrationCompleteResponseSchema>
