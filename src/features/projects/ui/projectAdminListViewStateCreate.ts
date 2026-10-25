import * as v from "valibot"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { projectCreateRequestSchema } from "../public/projectCreateRequestSchema.js"
import type { ProjectListQuery } from "../public/projectListQuerySchema.js"
import type { ProjectAdminPageState } from "./projectAdminPageStateCreate.js"

/** View state for the project directory: debounced search, status filter, create dialog, and navigation. */
export function projectAdminListViewStateCreate(options: {
  readonly basePath: string
  readonly createOpen: () => boolean
  readonly createOpenSet: (open: boolean) => void
  readonly organizationId: () => string | undefined
  readonly page: ProjectAdminPageState
  readonly search: () => string
  readonly searchSet: (value: string) => void
  readonly statusFilter: () => NonNullable<ProjectListQuery["status"]>
  readonly statusFilterSet: (value: string) => void
  readonly withActor: (href: string) => string
}) {
  const name = createSignalObject("")
  const organizationId = createSignalObject(options.organizationId() ?? "")
  const formError = createSignalObject<string | undefined>(undefined)

  // Projects arrive server-filtered by search and status; the view renders the loaded page as-is.
  const filteredProjects = () => options.page.projects()
  const searchInput = (value: string) => options.searchSet(value)
  const createSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    const selectedOrganization = organizationId.get() || (options.organizationId() ?? "")
    const parsed = v.safeParse(projectCreateRequestSchema, {
      name: name.get(),
      organizationId: selectedOrganization,
    })
    if (!parsed.success) {
      formError.set(messageTranslate("admin.projects.list.invalid"))
      return
    }
    formError.set(undefined)
    const created = await options.page.projectCreate(parsed.output.name, parsed.output.organizationId)
    if (!created) return
    name.set("")
    options.createOpenSet(false)
  }

  return {
    createOpen: options.createOpen,
    createOpenSet: (open: boolean) => {
      formError.set(undefined)
      options.createOpenSet(open)
    },
    createSubmit,
    filteredProjects,
    formError: formError.get,
    name,
    organizationId,
    page: options.page,
    projectHref: (projectId: string) => options.withActor(`${options.basePath}/projects/${projectId}`),
    search: options.search,
    searchInput,
    searchSet: options.searchSet,
    statusFilter: options.statusFilter,
    statusFilterSet: options.statusFilterSet,
  }
}
