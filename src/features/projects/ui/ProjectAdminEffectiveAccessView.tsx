import { For, Show } from "solid-js"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProjectAdminStateBoundary } from "./ProjectAdminStateBoundary.js"
import type { ProjectAdminPageState } from "./projectAdminPageStateCreate.js"

export function ProjectAdminEffectiveAccessView(props: { readonly state: ProjectAdminPageState }) {
  const state = props.state
  return (
    <section class="grid min-w-0 gap-6">
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
        <CardWrapper class="min-w-0">
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

      <CardWrapper class="min-w-0">
        <h2 class="text-xl font-semibold">{messageTranslate("admin.projects.access.permissionTitle")}</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          {messageTranslate("admin.projects.access.permissionDescription")}
        </p>
        <Table aria-label={messageTranslate("admin.projects.access.permissionTitle")} class="mt-4" tabIndex={0}>
          <TableHeader>
            <TableRow>
              <TableHead class="whitespace-nowrap">{messageTranslate("admin.projects.roles.displayName")}</TableHead>
              <TableHead class="whitespace-nowrap">{messageTranslate("admin.projects.roles.key")}</TableHead>
              <TableHead class="whitespace-nowrap">
                {messageTranslate("admin.projects.access.permissionTitle")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <For each={state.permissionRoles()}>
              {(role) => (
                <TableRow>
                  <TableCell class="font-medium whitespace-nowrap">{role.name}</TableCell>
                  <TableCell class="font-mono text-xs whitespace-nowrap">{role.roleId}</TableCell>
                  <TableCell class="min-w-64 whitespace-normal break-words text-xs text-muted-foreground">
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
