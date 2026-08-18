import * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { passkeyCredentialSchema } from "./passkeyCredentialSchema.js"

export const passkeyCredentialListResponseSchema = listResponseSchemaCreate(passkeyCredentialSchema)

export type PasskeyCredentialListResponse = v.InferOutput<typeof passkeyCredentialListResponseSchema>
