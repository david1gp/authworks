import { productionShellAccessResolve } from "../../../ui/production/productionShellAccessResolve.js"
import type { OrganizationRoleId } from "../../organizations/public/organizationRoleIdSchema.js"
import type { loginApiCreate } from "../ui/loginApiCreate.js"
import { loginDefaultDestinationResolve } from "./loginDefaultDestinationResolve.js"

type LoginPostAuthApi = Pick<ReturnType<typeof loginApiCreate>, "meCurrentGet" | "meOrganizationsList">

/**
 * Resolves the post-sign-in landing destination for a freshly authenticated session. Realm
 * administrators and owners/admins of the active organization land on `/admin/users`; everyone
 * else keeps `/account`. Resolution failures fall back to `undefined` so callers keep `/account`.
 */
export async function loginPostAuthDestinationResolve(options: {
  readonly api: LoginPostAuthApi
  readonly organizationId: string | undefined
  readonly realmId: string
}): Promise<"/account" | "/admin/users" | undefined> {
  const current = await options.api.meCurrentGet(options.realmId)
  if (!current.success) return undefined
  if (current.status !== "current") return undefined
  const memberships = await options.api.meOrganizationsList(options.realmId)
  if (!memberships.success) return undefined
  if (memberships.status !== "current") return undefined
  const activeId = options.organizationId
  const organizationRoles =
    activeId === undefined
      ? []
      : (memberships.data.items.find((item) => item.organization.id === activeId)?.membership.roles ??
        ([] as readonly OrganizationRoleId[]))
  return loginDefaultDestinationResolve(
    productionShellAccessResolve({
      capabilities: current.data.capabilities,
      organizationRoles,
      subjectType: "user",
    }),
  )
}
