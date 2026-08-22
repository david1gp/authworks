import { For, Show } from "solid-js"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProjectAdminStateBoundary } from "./ProjectAdminStateBoundary.js"
import type { ProjectAdminPageState } from "./projectAdminPageStateCreate.js"

export function ProjectAdminEffectiveAccessView(props: { readonly state: ProjectAdminPageState }) {
  const state = props.state
  return (
    <section class="grid gap-6">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">{messageTranslate("admin.projects.access.title")}</h1>
        <p class="mt-1 text-sm text-muted-foreground">{messageTranslate("admin.projects.access.description")}</p>
      </div>

      <ProjectAdminStateBoundary
        emptyDetail={messageTranslate("admin.projects.access.empty")}
        error={state.error()}
        onRetry={state.reload}
        status={state.status()}
      >
        <CardWrapper>
          <dl class="grid gap-4 sm:grid-cols-2">
            <div>
              <dt class="text-sm text-muted-foreground">{messageTranslate("admin.projects.access.roleKeys")}</dt>
              <dd class="mt-2 flex flex-wrap gap-2">
                <For each={state.access().roleKeys}>
                  {(roleKey) => (
                    <span class="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">
                      {roleKey}
                    </span>
                  )}
                </For>
              </dd>
            </div>
            <Show when={state.access().grantedOrganizationId}>
              {(organizationId) => (
                <div>
                  <dt class="text-sm text-muted-foreground">
                    {messageTranslate("admin.projects.access.grantedOrganization")}
                  </dt>
                  <dd class="mt-2 text-sm">{state.organizationName(organizationId())}</dd>
                </div>
              )}
            </Show>
          </dl>
        </CardWrapper>
      </ProjectAdminStateBoundary>

      <CardWrapper>
        <h3 class="text-xl font-semibold">{messageTranslate("admin.projects.access.permissionTitle")}</h3>
        <p class="mt-1 text-sm text-muted-foreground">
          {messageTranslate("admin.projects.access.permissionDescription")}
        </p>
        <Table class="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead>{messageTranslate("admin.projects.roles.displayName")}</TableHead>
              <TableHead>{messageTranslate("admin.projects.roles.key")}</TableHead>
              <TableHead>{messageTranslate("admin.projects.access.permissionTitle")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <For each={state.permissionRoles()}>
              {(role) => (
                <TableRow>
                  <TableCell class="font-medium">{role.name}</TableCell>
                  <TableCell class="font-mono text-xs">{role.roleId}</TableCell>
                  <TableCell class="text-xs text-muted-foreground">
                    {role.permissions.length === 0 ? "—" : role.permissions.join(", ")}
                  </TableCell>
                </TableRow>
              )}
            </For>
          </TableBody>
        </Table>
      </CardWrapper>
    </section>
  )
}
