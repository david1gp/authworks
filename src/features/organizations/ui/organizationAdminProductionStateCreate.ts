import { useParams } from "@solidjs/router"
import { confirmStateCreate } from "../../../ui/confirm/confirmStateCreate.js"
import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import { organizationAdminApiCreate } from "./organizationAdminApiCreate.js"
import { organizationAdminPageStateCreate } from "./organizationAdminPageStateCreate.js"
import type { OrganizationAdminScreen } from "./organizationAdminScreenSchema.js"
import { organizationAdminScreenStateCreate } from "./organizationAdminScreenStateCreate.js"

/** Binds the organization administration screens to realm-scoped browser clients. */
export function organizationAdminProductionStateCreate(screen: () => OrganizationAdminScreen) {
  const session = productionSessionContextGet()
  const params = useParams<{ organizationId?: string }>()
  const realmId = () => {
    const realm = session.guard.realm
    return typeof realm === "object" ? realm.realmId : ""
  }
  const organizationId = () => {
    if (params.organizationId !== undefined) return params.organizationId
    const organization = session.guard.organization
    return typeof organization === "object" ? organization.organizationId : ""
  }
  const adapter = organizationAdminApiCreate({ baseUrl: window.location.origin, realmId })
  // Destructive prompts are rendered in-app, so they are translated and always cancelable.
  const confirmState = confirmStateCreate()
  const page = organizationAdminPageStateCreate({ adapter, confirm: confirmState.confirm, organizationId, screen })

  return organizationAdminScreenStateCreate({ basePath: "/admin", confirmState, page })
}
