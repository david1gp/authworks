import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import { eventApiClientCreate } from "../../events/client/eventApiClientCreate.js"
import { adminActivityProductionAdapterCreate } from "./adminActivityProductionAdapterCreate.js"

export function adminActivityProductionStateCreate() {
  const session = productionSessionContextGet()
  const realmId = () => (typeof session.guard.realm === "object" ? session.guard.realm.realmId : "")
  const organizationId = () =>
    typeof session.guard.organization === "object" ? session.guard.organization.organizationId : undefined
  return {
    contextError: () => session.guard.organization === "missing" && session.guard.organizationResolutionFailed === true,
    retryContext: () => window.location.reload(),
    allowed: () =>
      session.guard.organizationResolutionFailed !== true &&
      (organizationId() !== undefined ||
        (session.guard.access !== "loading" && session.guard.access.realmAdministrator)),
    ready: () => session.guard.organization !== "loading" && realmId() !== "",
    adapter: adminActivityProductionAdapterCreate(
      eventApiClientCreate({ baseUrl: typeof window === "undefined" ? "http://localhost" : window.location.origin }),
    ),
    realmId,
    organizationId,
    contextLabel: () =>
      organizationId() === undefined
        ? (session.realms.find((item) => item.id === realmId())?.label ?? realmId())
        : (session.organizations.find((item) => item.id === organizationId())?.label ?? organizationId() ?? ""),
  }
}
