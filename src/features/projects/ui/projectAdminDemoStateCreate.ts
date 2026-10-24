import { useLocation } from "@solidjs/router"
import { adminDemoAccessSelect } from "../../admin/ui/adminDemoAppStateCreate.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { demoFixtureStateLabel } from "../../demo/public/demoFixtureStateLabel.js"
import { projectAdminDemoAdapterCreate } from "./projectAdminDemoAdapterCreate.js"
import type { ProjectAdminScreen } from "./projectAdminScreenSchema.js"
import { projectAdminScreenStateCreate } from "./projectAdminScreenStateCreate.js"

const demoAvailableStates = ["success", "empty", "loading", "error", "permission-denied"] as const

/**
 * Demo mount for the project directory and detail screens: fixture adapter
 * honouring `?as=` plus the shared view, wrapped in the fixture switcher.
 */
export function projectAdminDemoStateCreate(options: {
  readonly projectId: () => string | undefined
  readonly screen: () => ProjectAdminScreen
}) {
  const location = useLocation()
  const access = () => adminDemoAccessSelect(location.search)
  const asParam = () => (access() === "realm-admin" ? undefined : access())
  const withActor = (href: string) =>
    asParam() === undefined ? href : `${href}${href.includes("?") ? "&" : "?"}as=${asParam()}`
  const fixtureState = () => demoFixtureStateSelect(location.search, [...demoAvailableStates])
  const screenState = projectAdminScreenStateCreate({
    adapter: projectAdminDemoAdapterCreate(fixtureState),
    basePath: "/demo/admin",
    canManage: () => access() === "owner" || access() === "admin" || access() === "realm-admin",
    organizationId: () => "01900000-0000-7000-8000-000000000011",
    projectId: options.projectId,
    screen: options.screen,
    withActor,
  })
  const scenarioPath = () =>
    options.screen() === "projects"
      ? "/demo/admin/projects"
      : `/demo/admin/projects/${options.projectId() ?? "01900000-0000-7000-8000-000000000031"}`
  return {
    ...screenState,
    fixtureState,
    stateOptions: () =>
      demoAvailableStates.map((state) => {
        const search = new URLSearchParams()
        if (asParam() !== undefined) search.set("as", asParam() as string)
        search.set("state", state)
        return {
          href: `${scenarioPath()}?${search.toString()}`,
          label: demoFixtureStateLabel(state),
          selected: state === fixtureState(),
        }
      }),
  }
}
