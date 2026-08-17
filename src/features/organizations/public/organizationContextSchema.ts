import * as v from "valibot"
import { organizationResourceIdSchema } from "./organizationResourceIdSchema.js"

export const organizationContextSchema = v.strictObject({
  actorId: v.pipe(v.string(), v.minLength(1)),
  instanceId: organizationResourceIdSchema,
  kind: v.literal("organization"),
  organizationId: organizationResourceIdSchema,
})

export type OrganizationContext = v.InferOutput<typeof organizationContextSchema>
