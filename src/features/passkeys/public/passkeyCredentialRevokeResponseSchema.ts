import * as v from "valibot"
import { passkeyCredentialSchema } from "./passkeyCredentialSchema.js"

export const passkeyCredentialRevokeResponseSchema = v.strictObject({ credential: passkeyCredentialSchema })

export type PasskeyCredentialRevokeResponse = v.InferOutput<typeof passkeyCredentialRevokeResponseSchema>
