import * as v from "valibot"
import { listQuerySchema } from "../../../platform/http/listQuerySchema.js"
import { organizationResourceIdSchema } from "../../organizations/public/organizationResourceIdSchema.js"

export const projectListQuerySchema = v.strictObject({
  ...listQuerySchema.entries,
  organizationId: v.optional(organizationResourceIdSchema),
})

export type ProjectListQuery = v.InferOutput<typeof projectListQuerySchema>
