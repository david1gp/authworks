import * as v from "valibot"
import { authorizationPermissionSchema } from "./authorizationPermissionSchema.js"

export const authorizationResolvedAccessSchema = v.strictObject({
  permissions: v.array(authorizationPermissionSchema),
  roleKeys: v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
})

export type AuthorizationResolvedAccess = v.InferOutput<typeof authorizationResolvedAccessSchema>
