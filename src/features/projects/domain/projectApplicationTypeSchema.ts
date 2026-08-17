import * as v from "valibot"

export const projectApplicationTypeSchema = v.picklist(["oidc", "api", "saml"])

export type ProjectApplicationType = v.InferOutput<typeof projectApplicationTypeSchema>
