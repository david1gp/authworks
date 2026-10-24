import { useLocation, useNavigate } from "@solidjs/router"
import * as v from "valibot"
import { confirmStateCreate } from "../../../ui/confirm/confirmStateCreate.js"
import type { ProjectAdminAdapter } from "./projectAdminAdapter.js"
import { projectAdminApplicationsTabStateCreate } from "./projectAdminApplicationsTabStateCreate.js"
import { projectAdminDetailViewStateCreate } from "./projectAdminDetailViewStateCreate.js"
import { projectAdminListViewStateCreate } from "./projectAdminListViewStateCreate.js"
import { projectAdminOverviewTabStateCreate } from "./projectAdminOverviewTabStateCreate.js"
import { projectAdminPageStateCreate } from "./projectAdminPageStateCreate.js"
import { projectAdminRolesTabStateCreate } from "./projectAdminRolesTabStateCreate.js"
import type { ProjectAdminScreen } from "./projectAdminScreenSchema.js"
import { projectAdminAccessTabStateCreate } from "./projectDetailAccessTabStateCreate.js"
import { projectDetailTabSelect } from "./projectDetailTabSelect.js"

const dialogSchema = v.picklist([
  "create-project",
  "rename-project",
  "remove-project",
  "role",
  "application",
  "grant",
  "grant-organization",
  "assign-user",
])

/**
 * Wires the adapter-agnostic page state to URL-held view state so dialogs,
 * search, and the selected tab survive reloads and deep links.
 */
export function projectAdminScreenStateCreate(options: {
  readonly adapter: ProjectAdminAdapter
  readonly basePath: string
  readonly canManage: () => boolean
  readonly organizationId: () => string | undefined
  readonly projectId: () => string | undefined
  readonly screen: () => ProjectAdminScreen
  readonly withActor: (href: string) => string
}) {
  // Destructive prompts are rendered in-app, so they are translated and always cancelable.
  const confirmState = confirmStateCreate()
  const location = useLocation()
  const navigate = useNavigate()

  const dialogOpen = (kind: v.InferOutput<typeof dialogSchema>) => () => {
    const parsed = v.safeParse(dialogSchema, new URLSearchParams(location.search).get("dialog"))
    return parsed.success && parsed.output === kind
  }
  const dialogOpenSet = (kind: v.InferOutput<typeof dialogSchema>) => (open: boolean) => {
    const params = new URLSearchParams(location.search)
    if (open) params.set("dialog", kind)
    else params.delete("dialog")
    const encoded = params.toString()
    navigate(`${location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`, { replace: true })
  }
  const search = () => new URLSearchParams(location.search).get("q") ?? ""

  const page = projectAdminPageStateCreate({
    adapter: options.adapter,
    confirm: confirmState.confirm,
    organizationId: options.organizationId,
    projectId: options.projectId,
    screen: options.screen,
  })

  const detail = projectAdminDetailViewStateCreate({
    basePath: options.basePath,
    canManage: options.canManage,
    onDeleted: () => navigate(options.withActor(`${options.basePath}/projects`)),
    organizationId: options.organizationId,
    page,
    removeOpen: dialogOpen("remove-project"),
    removeOpenSet: dialogOpenSet("remove-project"),
    renameOpen: dialogOpen("rename-project"),
    renameOpenSet: dialogOpenSet("rename-project"),
    tab: () => projectDetailTabSelect(location.search),
    withActor: options.withActor,
  })
  const overview = projectAdminOverviewTabStateCreate({ canManage: options.canManage, page })
  const rolesTab = projectAdminRolesTabStateCreate({
    createOpen: dialogOpen("role"),
    createOpenSet: dialogOpenSet("role"),
    page,
    projectId: () => options.projectId() ?? "",
  })
  const applications = projectAdminApplicationsTabStateCreate({
    createOpen: dialogOpen("application"),
    createOpenSet: dialogOpenSet("application"),
    page,
    projectId: () => options.projectId() ?? "",
  })
  const accessTab = projectAdminAccessTabStateCreate({
    assignOpen: dialogOpen("assign-user"),
    assignOpenSet: dialogOpenSet("assign-user"),
    grantOrganizationOpen: dialogOpen("grant-organization"),
    grantOrganizationOpenSet: dialogOpenSet("grant-organization"),
    grantRoleOpen: dialogOpen("grant"),
    grantRoleOpenSet: dialogOpenSet("grant"),
    page,
    projectId: () => options.projectId() ?? "",
  })

  return {
    accessTab,
    applications,
    canManage: options.canManage,
    confirmState,
    detail,
    list: projectAdminListViewStateCreate({
      createOpen: dialogOpen("create-project"),
      createOpenSet: dialogOpenSet("create-project"),
      organizationId: options.organizationId,
      page,
      search,
      searchSet: (value: string) => {
        const params = new URLSearchParams(location.search)
        if (value.length === 0) params.delete("q")
        else params.set("q", value)
        const encoded = params.toString()
        navigate(`${location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`, { replace: true })
      },
      withActor: options.withActor,
    }),
    organizationId: options.organizationId,
    overview,
    page,
    projectId: options.projectId,
    rolesTab,
    screen: options.screen,
    tab: () => projectDetailTabSelect(location.search),
    withActor: options.withActor,
  }
}
