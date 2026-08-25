import * as v from "valibot"
import { authorizationActorContextSchema } from "../../authorization/public/authorizationActorContextSchema.js"
import { realmResourceIdSchema } from "../../realms/public/realmResourceIdSchema.js"
import { organizationResourceIdSchema } from "./organizationResourceIdSchema.js"

export const organizationContextSchema = v.strictObject({
  actor: authorizationActorContextSchema,
  actorId: v.pipe(v.string(), v.minLength(1)),
  realmId: realmResourceIdSchema,
  kind: v.literal("organization"),
  organizationId: organizationResourceIdSchema,
})

export type OrganizationContext = v.InferOutput<typeof organizationContextSchema>
