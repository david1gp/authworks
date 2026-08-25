import * as v from "valibot"
import { authorizationPermissionSchema } from "../../authorization/public/authorizationPermissionSchema.js"
import { organizationAccountAccessSchema } from "../../organizations/public/organizationAccountAccessSchema.js"
import { projectGrantSchema } from "../../projects/public/projectGrantSchema.js"
import { projectSchema } from "../../projects/public/projectSchema.js"
import { accountEffectiveAccessSourceSchema } from "./accountEffectiveAccessSourceSchema.js"

export const accountEffectiveAccessEntrySchema = v.strictObject({
  grant: v.optional(projectGrantSchema),
  id: v.pipe(v.string(), v.minLength(1), v.maxLength(512)),
  organization: organizationAccountAccessSchema,
  permissions: v.array(authorizationPermissionSchema),
  project: v.optional(projectSchema),
  roleKeys: v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(200))), v.maxLength(200)),
  source: accountEffectiveAccessSourceSchema,
})

export type AccountEffectiveAccessEntry = v.InferOutput<typeof accountEffectiveAccessEntrySchema>
