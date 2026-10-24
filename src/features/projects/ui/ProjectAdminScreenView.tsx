import { Match, Switch } from "solid-js"
import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { ProjectAdminListView } from "./ProjectAdminListView.js"
import { ProjectDetailView } from "./ProjectDetailView.js"
import type { projectAdminScreenStateCreate } from "./projectAdminScreenStateCreate.js"

/** The single stateless view shared by the production and demo project adapters. */
export function ProjectAdminScreenView(props: { readonly state: ReturnType<typeof projectAdminScreenStateCreate> }) {
  const state = props.state
  return (
    <>
      <ConfirmDialog state={state.confirmState} titleKey="admin.common.confirmTitle" />
      <Switch>
        <Match when={state.screen() === "projects"}>
          <ProjectAdminListView state={state.list} />
        </Match>
        <Match when={state.screen() === "project-detail"}>
          <ProjectDetailView state={state} />
        </Match>
      </Switch>
    </>
  )
}
