import * as v from "valibot"
import { organizationBrandingAssetSchema } from "./organizationBrandingAssetSchema.js"

const organizationBrandingColorSchema = v.pipe(v.string(), v.regex(/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i))

export const organizationBrandingThemeSchema = v.strictObject({
  backgroundColor: organizationBrandingColorSchema,
  fontColor: organizationBrandingColorSchema,
  iconUrl: v.optional(
    v.pipe(
      v.string(),
      v.url(),
      v.check((value) => new URL(value).protocol === "https:"),
    ),
  ),
  icon: v.optional(organizationBrandingAssetSchema),
  logo: v.optional(organizationBrandingAssetSchema),
  logoUrl: v.optional(
    v.pipe(
      v.string(),
      v.url(),
      v.check((value) => new URL(value).protocol === "https:"),
    ),
  ),
  primaryColor: organizationBrandingColorSchema,
  warnColor: organizationBrandingColorSchema,
})

export type OrganizationBrandingTheme = v.InferOutput<typeof organizationBrandingThemeSchema>
