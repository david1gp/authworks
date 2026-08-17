import * as v from "valibot"
import { organizationBrandingAssetSchema } from "./organizationBrandingAssetSchema.js"
import { organizationBrandingThemeSchema } from "./organizationBrandingThemeSchema.js"

export const organizationBrandingSchema = v.strictObject({
  dark: organizationBrandingThemeSchema,
  disableWatermark: v.boolean(),
  font: v.optional(organizationBrandingAssetSchema),
  fontUrl: v.optional(
    v.pipe(
      v.string(),
      v.url(),
      v.check((value) => new URL(value).protocol === "https:"),
    ),
  ),
  legal: v.optional(
    v.strictObject({
      privacyUrl: v.optional(
        v.pipe(
          v.string(),
          v.url(),
          v.check((value) => new URL(value).protocol === "https:"),
        ),
      ),
      termsUrl: v.optional(
        v.pipe(
          v.string(),
          v.url(),
          v.check((value) => new URL(value).protocol === "https:"),
        ),
      ),
    }),
  ),
  legalUrls: v.optional(
    v.strictObject({
      privacyUrl: v.optional(
        v.pipe(
          v.string(),
          v.url(),
          v.check((value) => new URL(value).protocol === "https:"),
        ),
      ),
      termsUrl: v.optional(
        v.pipe(
          v.string(),
          v.url(),
          v.check((value) => new URL(value).protocol === "https:"),
        ),
      ),
    }),
  ),
  light: organizationBrandingThemeSchema,
  themeMode: v.picklist(["dark", "light", "system"]),
})

export type OrganizationBranding = v.InferOutput<typeof organizationBrandingSchema>
