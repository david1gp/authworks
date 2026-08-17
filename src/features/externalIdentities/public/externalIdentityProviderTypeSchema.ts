import * as v from "valibot"

export const externalIdentityProviderTypeSchema = v.picklist(["google", "github", "microsoft"])

export type ExternalIdentityProviderType = v.InferOutput<typeof externalIdentityProviderTypeSchema>
