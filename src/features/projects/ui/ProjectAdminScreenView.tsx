import { Match, Switch } from "solid-js"
import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { ProjectAdminApplicationsView } from "./ProjectAdminApplicationsView.js"
import { ProjectAdminDetailView } from "./ProjectAdminDetailView.js"
import { ProjectAdminEffectiveAccessView } from "./ProjectAdminEffectiveAccessView.js"
import { ProjectAdminListView } from "./ProjectAdminListView.js"
import { ProjectAdminRolesGrantsView } from "./ProjectAdminRolesGrantsView.js"
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
          <ProjectAdminDetailView state={state.detail} />
        </Match>
        <Match when={state.screen() === "applications"}>
          <ProjectAdminApplicationsView state={state.applications} />
        </Match>
        <Match when={state.screen() === "roles-grants"}>
          <ProjectAdminRolesGrantsView state={state.rolesGrants} />
        </Match>
        <Match when={state.screen() === "effective-access"}>
          <ProjectAdminEffectiveAccessView state={state.page} />
        </Match>
      </Switch>
    </>
  )
}
