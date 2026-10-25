import { useLocation, useNavigate, useParams } from "@solidjs/router"
import { confirmStateCreate } from "../../../ui/confirm/confirmStateCreate.js"
import { adminDemoAccessSelect } from "../../admin/ui/adminDemoAppStateCreate.js"
import { demoAdminScenarioGroups } from "../../demo/demoAdminScenarioGroups.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { demoFixtureStateLabel } from "../../demo/public/demoFixtureStateLabel.js"
import type { DirectoryUserProfileAdapter } from "./directoryUserProfileAdapter.js"
import { directoryUserProfileDemoAdapterCreate } from "./directoryUserProfileDemoAdapterCreate.js"
import { directoryUserProfilePageStateCreate } from "./directoryUserProfilePageStateCreate.js"
import { directoryUserProfileDialogSelect, directoryUserProfileTabSelect } from "./directoryUserProfileUrlState.js"

const availableStates = ["success", "empty", "loading", "error", "permission-denied", "expired"] as const

/**
 * Binds the user profile screen to deterministic fixtures, honouring `?as=`, `?state=`,
 * `?tab=`, and `?dialog=`. Unknown users fall back to the first fixture user so dialogs
 * and tabs stay exercisable under every actor.
 */
export function directoryUserProfileDemoStateCreate() {
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams<{ userId?: string }>()
  const access = () => adminDemoAccessSelect(location.search)
  const scenario = () => demoFixtureScenarioSelect(location.pathname, demoAdminScenarioGroups)
  const fixtureState = () => demoFixtureStateSelect(location.search, scenario()?.states ?? [...availableStates])
  const asParam = () => (access() === "realm-admin" ? undefined : access())
  const withActor = (href: string) =>
    asParam() === undefined ? href : `${href}${href.includes("?") ? "&" : "?"}as=${asParam()}`
  const adapter: DirectoryUserProfileAdapter = directoryUserProfileDemoAdapterCreate(fixtureState, () => access())
  const confirmState = confirmStateCreate()
  const userId = () => params.userId ?? "01900000-0000-7000-8000-000000000021"
  const organizationId = () => "01900000-0000-7000-8000-000000000011"
  const page = directoryUserProfilePageStateCreate(adapter, {
    actorOrganizationRoles: () => (access() === "owner" ? ["owner"] : access() === "admin" ? ["admin"] : []),
    actorRealmAdministrator: () => access() === "realm-admin",
    confirm: confirmState.confirm,
    organizationId,
    realmId: () => "01900000-0000-7000-8000-000000000001",
    reloadKey: fixtureState,
    userId,
  })

  const paramsSet = (mutate: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams(location.search)
    mutate(next)
    const encoded = next.toString()
    navigate(`${location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`, { replace: true })
  }
  const dialogOpenSet =
    (dialog: "edit-profile" | "assign-roles" | "set-password" | "delete" | undefined) => (open: boolean) => {
      if (open) page.formErrorClear()
      paramsSet((next) => {
        if (open && dialog !== undefined) next.set("dialog", dialog)
        else next.delete("dialog")
      })
    }

  return {
    access,
    asParam,
    basePath: "/demo/admin",
    confirmState,
    dialog: () => directoryUserProfileDialogSelect(location.search),
    dialogOpenSet,
    fixtureState,
    organizationName: () => "Acme Corporation",
    page,
    stateOptions: () =>
      availableStates.map((state) => {
        const search = new URLSearchParams()
        if (asParam() !== undefined) search.set("as", asParam() as string)
        search.set("state", state)
        return {
          href: `${location.pathname}?${search.toString()}`,
          label: demoFixtureStateLabel(state),
          selected: state === fixtureState(),
        }
      }),
    tab: () => directoryUserProfileTabSelect(location.search),
    userId,
    withActor,
  }
}

export type DirectoryUserProfileDemoState = ReturnType<typeof directoryUserProfileDemoStateCreate>
