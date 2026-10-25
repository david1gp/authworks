import { useLocation } from "@solidjs/router"
import { confirmStateCreate } from "../../../ui/confirm/confirmStateCreate.js"
import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import { organizationAdminApiCreate } from "./organizationAdminApiCreate.js"
import { organizationAdminListSearchSelect } from "./organizationAdminListSearchSelect.js"
import { organizationAdminListStatusSelect } from "./organizationAdminListStatusSelect.js"
import { organizationAdminPageStateCreate } from "./organizationAdminPageStateCreate.js"
import type { OrganizationAdminScreen } from "./organizationAdminScreenSchema.js"
import { organizationAdminScreenStateCreate } from "./organizationAdminScreenStateCreate.js"

/** Binds the organization administration screens to realm-scoped browser clients. */
export function organizationAdminProductionStateCreate(options: {
  readonly organizationId: () => string | undefined
  readonly screen: () => OrganizationAdminScreen
}) {
  const session = productionSessionContextGet()
  const location = useLocation()
  const realmId = () => {
    const realm = session.guard.realm
    return typeof realm === "object" ? realm.realmId : ""
  }
  const organizationId = () => {
    if (new URLSearchParams(location.search).get("scope") === "realm") return ""
    // Production routes render through catch-all `/admin/*adminPath` entries, so `useParams`
    // carries no `:organizationId`; prefer the explicit prop, which the route resolves from
    // its own path contract (same pattern as the machine-user and project screens).
    const fromRoute = options.organizationId()
    if (fromRoute !== undefined) return fromRoute
    const organization = session.guard.organization
    return typeof organization === "object" ? organization.organizationId : ""
  }
  const adapter = organizationAdminApiCreate({ baseUrl: window.location.origin, realmId })
  // Destructive prompts are rendered in-app, so they are translated and always cancelable.
  const confirmState = confirmStateCreate()
  const page = organizationAdminPageStateCreate({
    adapter,
    confirm: confirmState.confirm,
    listSearch: () => organizationAdminListSearchSelect(location.search),
    listStatus: () => organizationAdminListStatusSelect(location.search),
    organizationId,
    screen: options.screen,
  })

  return organizationAdminScreenStateCreate({ basePath: "/admin", confirmState, page })
}
