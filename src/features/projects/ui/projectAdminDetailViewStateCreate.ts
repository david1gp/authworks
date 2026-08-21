import { createEffect, on } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { ProjectAdminPageState } from "./projectAdminPageStateCreate.js"

/** View state for project settings: the editable form mirrors the loaded project. */
export function projectAdminDetailViewStateCreate(options: {
  readonly onDeleted: () => void
  readonly page: ProjectAdminPageState
}) {
  const name = createSignalObject("")
  const authorizationRequired = createSignalObject(false)
  const projectAccessRequired = createSignalObject(false)

  createEffect(
    on(
      () => options.page.project(),
      (project) => {
        if (project === undefined) return
        name.set(project.name)
        authorizationRequired.set(project.authorizationRequired)
        projectAccessRequired.set(project.projectAccessRequired)
      },
    ),
  )

  return {
    authorizationRequired,
    name,
    page: options.page,
    projectAccessRequired,
    projectDelete: async (projectId: string) => {
      const deleted = await options.page.projectDelete(projectId)
      if (deleted) options.onDeleted()
    },
    settingsSubmit: (event: SubmitEvent) => {
      event.preventDefault()
      const project = options.page.project()
      if (project === undefined) return
      void options.page.projectUpdate(project.id, {
        authorizationRequired: authorizationRequired.get(),
        name: name.get(),
        projectAccessRequired: projectAccessRequired.get(),
      })
    },
  }
}
