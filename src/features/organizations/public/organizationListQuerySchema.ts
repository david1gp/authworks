import * as v from "valibot"
import { listQuerySchema } from "../../../platform/http/listQuerySchema.js"

export const organizationListQuerySchema = v.strictObject({
  ...listQuerySchema.entries,
  status: v.optional(v.picklist(["active", "inactive", "all"])),
})

export type OrganizationListQuery = v.InferOutput<typeof organizationListQuerySchema>
