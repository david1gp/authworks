import * as v from "valibot"

const sectionSchema = v.optional(v.picklist(["general", "branding", "sign-in", "domains"]), "general")

/** Validated configuration section from the `:section` route param; unknown values fall back. */
export function organizationConfigurationSectionSelect(section: string | undefined) {
  const parsed = v.safeParse(sectionSchema, section)
  return parsed.success ? parsed.output : "general"
}
