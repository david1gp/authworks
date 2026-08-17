import * as v from "valibot"
import { authorizationPermissionSchema } from "./authorizationPermissionSchema.js"
import { sessionAssuranceSchema } from "../../sessions/public/sessionAssuranceSchema.js"

export const authorizationPolicyRuleSchema = v.object({
  effect: v.picklist(["allow", "deny"]),
  minimumAssurance: v.optional(sessionAssuranceSchema),
  permission: authorizationPermissionSchema,
  resourceId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
})

export type AuthorizationPolicyRule = v.InferOutput<typeof authorizationPolicyRuleSchema>
