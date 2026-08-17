import * as v from "valibot"
import { externalIdentityProviderSchema } from "./externalIdentityProviderSchema.js"

export const externalIdentityProviderResponseSchema = v.strictObject({ provider: externalIdentityProviderSchema })

export type ExternalIdentityProviderResponse = v.InferOutput<typeof externalIdentityProviderResponseSchema>
