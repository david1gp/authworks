import * as v from "valibot"

export const organizationBrandingAssetSchema = v.strictObject({
  contentType: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  url: v.pipe(
    v.string(),
    v.url(),
    v.check((value) => new URL(value).protocol === "https:"),
  ),
})

export type OrganizationBrandingAsset = v.InferOutput<typeof organizationBrandingAssetSchema>
