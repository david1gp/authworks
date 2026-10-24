import { createEffect, on } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { ProjectAdminPageState } from "./projectAdminPageStateCreate.js"

/** View state for the project overview tab: the editable name and the two access flags. */
export function projectAdminOverviewTabStateCreate(options: {
  readonly canManage: () => boolean
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
    canManage: options.canManage,
    name,
    page: options.page,
    projectAccessRequired,
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
