import * as v from "valibot"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { projectApplicationCreateRequestSchema } from "../public/projectApplicationCreateRequestSchema.js"
import type { ProjectAdminPageState } from "./projectAdminPageStateCreate.js"

/** View state for project applications: create dialog and lifecycle actions. */
export function projectAdminApplicationsViewStateCreate(options: {
  readonly createOpen: () => boolean
  readonly createOpenSet: (open: boolean) => void
  readonly page: ProjectAdminPageState
  readonly projectId: () => string
}) {
  const name = createSignalObject("")
  const applicationType = createSignalObject("oidc")
  const formError = createSignalObject<string | undefined>(undefined)

  const createSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    const parsed = v.safeParse(projectApplicationCreateRequestSchema, {
      applicationType: applicationType.get(),
      name: name.get(),
    })
    if (!parsed.success) {
      formError.set(messageTranslate("admin.projects.applications.invalid"))
      return
    }
    formError.set(undefined)
    const created = await options.page.applicationCreate(
      options.projectId(),
      parsed.output.name,
      parsed.output.applicationType,
    )
    if (!created) return
    name.set("")
    options.createOpenSet(false)
  }

  return {
    applicationType,
    createOpen: options.createOpen,
    createOpenSet: (open: boolean) => {
      formError.set(undefined)
      options.createOpenSet(open)
    },
    createSubmit,
    formError: formError.get,
    lifecycleSet: (applicationId: string, status: "active" | "inactive" | "removed") =>
      void options.page.applicationLifecycleSet(options.projectId(), applicationId, status),
    name,
    page: options.page,
  }
}
