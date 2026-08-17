import * as v from "valibot"

export const organizationStatusSchema = v.picklist(["active", "inactive", "removed"])

export type OrganizationStatus = v.InferOutput<typeof organizationStatusSchema>
