import * as v from "valibot"

export const organizationConfigurationSectionSchema = v.picklist(["general", "branding", "sign-in", "domains"])

export type OrganizationConfigurationSection = v.InferOutput<typeof organizationConfigurationSectionSchema>
