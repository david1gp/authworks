import { useLocation, useNavigate } from "@solidjs/router"
import * as v from "valibot"
import { confirmStateCreate } from "../../../ui/confirm/confirmStateCreate.js"
import type { ProjectAdminAdapter } from "./projectAdminAdapter.js"
import { projectAdminApplicationsViewStateCreate } from "./projectAdminApplicationsViewStateCreate.js"
import { projectAdminDetailViewStateCreate } from "./projectAdminDetailViewStateCreate.js"
import { projectAdminListViewStateCreate } from "./projectAdminListViewStateCreate.js"
import { projectAdminPageStateCreate } from "./projectAdminPageStateCreate.js"
import { projectAdminRolesGrantsViewStateCreate } from "./projectAdminRolesGrantsViewStateCreate.js"
import type { ProjectAdminScreen } from "./projectAdminScreenSchema.js"

const dialogSchema = v.picklist(["project", "application", "role", "grant"])

/**
 * Wires the adapter-agnostic page state to URL-held view state so dialogs,
 * search, and the selected tab survive reloads and deep links.
 */
export function projectAdminScreenStateCreate(options: {
  readonly adapter: ProjectAdminAdapter
  readonly basePath: string
  readonly projectId: () => string | undefined
  readonly screen: () => ProjectAdminScreen
}) {
  // Destructive prompts are rendered in-app, so they are translated and always cancelable.
  const confirmState = confirmStateCreate()
  const location = useLocation()
  const navigate = useNavigate()

  const searchParamsSet = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(location.search)
    mutate(params)
    const encoded = params.toString()
    navigate(`${location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`, { replace: true })
  }
  const dialogOpen = (kind: v.InferOutput<typeof dialogSchema>) => {
    const parsed = v.safeParse(dialogSchema, new URLSearchParams(location.search).get("dialog"))
    return parsed.success && parsed.output === kind
  }
  const dialogOpenSet = (kind: v.InferOutput<typeof dialogSchema>) => (open: boolean) =>
    searchParamsSet((params) => {
      if (open) params.set("dialog", kind)
      else params.delete("dialog")
    })
  const search = () => new URLSearchParams(location.search).get("q") ?? ""

  const page = projectAdminPageStateCreate({
    adapter: options.adapter,
    confirm: confirmState.confirm,
    projectId: options.projectId,
    screen: options.screen,
  })

  return {
    applications: projectAdminApplicationsViewStateCreate({
      createOpen: () => dialogOpen("application"),
      createOpenSet: dialogOpenSet("application"),
      page,
      projectId: () => options.projectId() ?? "",
    }),
    confirmState,
    detail: projectAdminDetailViewStateCreate({
      onDeleted: () => navigate(`${options.basePath}/projects`),
      page,
    }),
    list: projectAdminListViewStateCreate({
      createOpen: () => dialogOpen("project"),
      createOpenSet: dialogOpenSet("project"),
      organizationIdInitial: () => page.organizations()[0]?.id ?? "",
      page,
      projectOpen: (projectId) => navigate(`${options.basePath}/projects/${projectId}`),
      search,
      searchSet: (value: string) =>
        searchParamsSet((params) => {
          if (value.length === 0) params.delete("q")
          else params.set("q", value)
        }),
    }),
    page,
    rolesGrants: projectAdminRolesGrantsViewStateCreate({
      grantCreateOpen: () => dialogOpen("grant"),
      grantCreateOpenSet: dialogOpenSet("grant"),
      page,
      projectId: () => options.projectId() ?? "",
      roleCreateOpen: () => dialogOpen("role"),
      roleCreateOpenSet: dialogOpenSet("role"),
    }),
    screen: options.screen,
  }
}
