import * as v from "valibot"
import type { OrganizationRoleId } from "../../features/organizations/public/organizationRoleIdSchema.js"
import { userCapabilitiesSchema } from "../../features/users/public/userCapabilitiesSchema.js"

export const productionShellAccessSchema = v.strictObject({
  organizationRoles: v.array(v.picklist(["owner", "admin", "member", "guest"])),
  realmAdministrator: v.boolean(),
})

export type ProductionShellAccess = v.InferOutput<typeof productionShellAccessSchema>

export function productionShellAccessResolve(options: {
  readonly capabilities?: v.InferOutput<typeof userCapabilitiesSchema> | undefined
  readonly organizationRoles?: readonly OrganizationRoleId[] | undefined
  readonly subjectType: "bootstrap_admin" | "user" | undefined
}): ProductionShellAccess {
  if (options.subjectType === "bootstrap_admin") return { organizationRoles: [], realmAdministrator: true }
  if (options.subjectType !== "user") return { organizationRoles: [], realmAdministrator: false }
  return {
    organizationRoles: [...(options.organizationRoles ?? [])],
    realmAdministrator: options.capabilities?.realmAdministrator === true,
  }
}
