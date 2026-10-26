import * as v from "valibot"
import { passkeyCredentialSchema } from "./passkeyCredentialSchema.js"

export const passkeyCredentialRenameResponseSchema = v.strictObject({ credential: passkeyCredentialSchema })

export type PasskeyCredentialRenameResponse = v.InferOutput<typeof passkeyCredentialRenameResponseSchema>
