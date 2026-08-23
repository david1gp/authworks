import * as v from "valibot"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { projectCreateRequestSchema } from "../public/projectCreateRequestSchema.js"
import type { ProjectAdminPageState } from "./projectAdminPageStateCreate.js"

/** View state for the project directory: search, create dialog, and navigation. */
export function projectAdminListViewStateCreate(options: {
  readonly createOpen: () => boolean
  readonly createOpenSet: (open: boolean) => void
  readonly organizationIdInitial: () => string
  readonly page: ProjectAdminPageState
  readonly projectOpen: (projectId: string) => void
  readonly search: () => string
  readonly searchSet: (value: string) => void
}) {
  const name = createSignalObject("")
  const organizationId = createSignalObject(options.organizationIdInitial())
  const formError = createSignalObject<string | undefined>(undefined)

  const filteredProjects = () => {
    const term = options.search().trim().toLowerCase()
    if (term.length === 0) return options.page.projects()
    return options.page.projects().filter((project) => `${project.name} ${project.id}`.toLowerCase().includes(term))
  }
  const createSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    const selectedOrganization = organizationId.get() || (options.page.organizations()[0]?.id ?? "")
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
    projectOpen: options.projectOpen,
    search: options.search,
    searchSet: options.searchSet,
  }
}
