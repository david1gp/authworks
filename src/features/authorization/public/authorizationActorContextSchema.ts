import * as v from "valibot"

export const authorizationActorContextSchema = v.object({
  actorId: v.pipe(v.string(), v.minLength(1)),
  assurance: v.picklist(["none", "authenticated"]),
  authenticationMethod: v.picklist(["none", "system", "trusted", "bootstrap_admin"]),
  instanceId: v.optional(v.pipe(v.string(), v.minLength(1))),
  kind: v.picklist(["anonymous", "user", "bootstrap_admin", "system"]),
  organizationId: v.optional(v.pipe(v.string(), v.minLength(1))),
})

export type AuthorizationActorContext = v.InferOutput<typeof authorizationActorContextSchema>
