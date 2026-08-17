import * as v from "valibot"
import { authorizationPermissionSchema } from "./authorizationPermissionSchema.js"

export const authorizationDecisionSchema = v.object({
  actorId: v.pipe(v.string(), v.minLength(1)),
  allowed: v.boolean(),
  instanceId: v.pipe(v.string(), v.minLength(1)),
  organizationId: v.optional(v.pipe(v.string(), v.minLength(1))),
  permission: authorizationPermissionSchema,
  reason: v.picklist([
    "anonymous",
    "bootstrap_admin",
    "insufficient_assurance",
    "impersonation_limit",
    "no_permission",
    "organization_mismatch",
    "policy",
    "resource_mismatch",
    "role",
    "system",
    "tenant_mismatch",
  ]),
  resourceId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
})

export type AuthorizationDecision = v.InferOutput<typeof authorizationDecisionSchema>
