import * as v from "valibot"
import { passkeyCredentialSchema } from "./passkeyCredentialSchema.js"

export const passkeyCredentialListResponseSchema = v.strictObject({ credentials: v.array(passkeyCredentialSchema) })

export type PasskeyCredentialListResponse = v.InferOutput<typeof passkeyCredentialListResponseSchema>
