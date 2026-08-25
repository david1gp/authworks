import * as v from "valibot"
import { organizationAccountAccessSchema } from "./organizationAccountAccessSchema.js"

export const organizationAccountAccessListResponseSchema = v.strictObject({
  items: v.array(organizationAccountAccessSchema),
})

export type OrganizationAccountAccessListResponse = v.InferOutput<typeof organizationAccountAccessListResponseSchema>
