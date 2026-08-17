import * as v from "valibot"
import { authorizationPermissionSchema } from "./authorizationPermissionSchema.js"
import { authorizationRoleIdSchema } from "./authorizationRoleIdSchema.js"

export const authorizationRoleDefinitionSchema = v.object({
  deniedPermissions: v.optional(v.array(authorizationPermissionSchema)),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  permissions: v.array(authorizationPermissionSchema),
  roleId: authorizationRoleIdSchema,
})

export type AuthorizationRoleDefinition = v.InferOutput<typeof authorizationRoleDefinitionSchema>
