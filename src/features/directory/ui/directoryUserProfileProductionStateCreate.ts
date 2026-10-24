import { useLocation, useNavigate, useParams } from "@solidjs/router"
import { confirmStateCreate } from "../../../ui/confirm/confirmStateCreate.js"
import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import type { DirectoryUserProfileAdapter } from "./directoryUserProfileAdapter.js"
import { directoryUserProfilePageStateCreate } from "./directoryUserProfilePageStateCreate.js"
import { directoryUserProfileProductionAdapterCreate } from "./directoryUserProfileProductionAdapterCreate.js"
import { directoryUserProfileDialogSelect, directoryUserProfileTabSelect } from "./directoryUserProfileUrlState.js"

/** Binds the user profile screen to realm-scoped browser clients and the active session context. */
export function directoryUserProfileProductionStateCreate() {
  const session = productionSessionContextGet()
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams<{ userId?: string }>()
  const realmId = () => {
    const realm = session.guard.realm
    return typeof realm === "object" ? realm.realmId : ""
  }
  const organizationId = () => {
    const organization = session.guard.organization
    return typeof organization === "object" ? organization.organizationId : ""
  }
  const organizationName = () => {
    const organizations = session.organizations
    return organizations.find((item) => item.id === organizationId())?.label ?? ""
  }
  const actorRoles = () => {
    const access = session.guard.access
    return access === "loading" ? [] : [...access.organizationRoles]
  }
  const actorRealmAdministrator = () => {
    const access = session.guard.access
    return access !== "loading" && access.realmAdministrator
  }
  const adapter: DirectoryUserProfileAdapter = directoryUserProfileProductionAdapterCreate({
    baseUrl: typeof window === "undefined" ? "http://localhost" : window.location.origin,
    organizationId,
    realmId,
  })
  const confirmState = confirmStateCreate()
  const userId = () => params.userId
  const page = directoryUserProfilePageStateCreate(adapter, {
    actorOrganizationRoles: actorRoles,
    actorRealmAdministrator,
    confirm: confirmState.confirm,
    organizationId,
    realmId,
    userId,
  })

  const paramsSet = (mutate: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams(location.search)
    mutate(next)
    const encoded = next.toString()
    navigate(`${location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`, { replace: true })
  }
  const dialogOpenSet =
    (dialog: "edit-profile" | "assign-roles" | "set-password" | "delete" | undefined) => (open: boolean) =>
      paramsSet((next) => {
        if (open && dialog !== undefined) next.set("dialog", dialog)
        else next.delete("dialog")
      })

  return {
    basePath: "/admin",
    confirmState,
    dialog: () => directoryUserProfileDialogSelect(location.search),
    dialogOpenSet,
    organizationName,
    page,
    tab: () => directoryUserProfileTabSelect(location.search),
    userId,
    withActor: (href: string) => href,
  }
}

export type DirectoryUserProfileProductionState = ReturnType<typeof directoryUserProfileProductionStateCreate>
