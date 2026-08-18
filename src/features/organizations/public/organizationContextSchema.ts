import * as v from "valibot"
import { authorizationActorContextSchema } from "../../authorization/public/authorizationActorContextSchema.js"
import { organizationResourceIdSchema } from "./organizationResourceIdSchema.js"

export const organizationContextSchema = v.strictObject({
  actor: authorizationActorContextSchema,
  actorId: v.pipe(v.string(), v.minLength(1)),
  realmId: organizationResourceIdSchema,
  kind: v.literal("organization"),
  organizationId: organizationResourceIdSchema,
})

export type OrganizationContext = v.InferOutput<typeof organizationContextSchema>
