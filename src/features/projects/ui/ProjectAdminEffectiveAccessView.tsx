import { For, Show } from "solid-js"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedRecordItem } from "../../../ui/authenticated/AuthenticatedRecordItem.js"
import { AuthenticatedRecordList } from "../../../ui/authenticated/AuthenticatedRecordList.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { authenticatedTableClasses } from "../../../ui/authenticated/authenticatedTableClasses.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProjectAdminProjectContext } from "./ProjectAdminProjectContext.js"
import { ProjectAdminStateBoundary } from "./ProjectAdminStateBoundary.js"
import type { ProjectAdminPageState } from "./projectAdminPageStateCreate.js"

export function ProjectAdminEffectiveAccessView(props: { readonly state: ProjectAdminPageState }) {
  const state = props.state
  return (
    <section aria-label={messageTranslate("admin.projects.access.title")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <ProjectAdminProjectContext page={state} />

      <ProjectAdminStateBoundary
        emptyDetail={messageTranslate("admin.projects.access.empty")}
        error={state.error()}
        onRetry={state.reload}
        status={state.status()}
      >
        <AuthenticatedSection
          description={messageTranslate("admin.projects.access.description")}
          padded
          title={messageTranslate("admin.projects.access.roleKeys")}
        >
          <AuthenticatedFieldList
            fields={[
              {
                label: messageTranslate("admin.projects.access.roleKeys"),
                value: (
                  <span class="flex flex-wrap gap-1.5">
                    <For each={state.access().roleKeys}>
                      {(roleKey) => <AuthenticatedStatus label={roleKey} tone="accent" />}
                    </For>
                  </span>
                ),
              },
              {
                label: messageTranslate("admin.projects.access.grantedOrganization"),
                value: (
                  <Show fallback="—" when={state.access().grantedOrganizationId}>
                    {(organizationId) => state.organizationName(organizationId())}
                  </Show>
                ),
              },
            ]}
          />
        </AuthenticatedSection>
      </ProjectAdminStateBoundary>

      <AuthenticatedSection
        description={messageTranslate("admin.projects.access.permissionDescription")}
        title={messageTranslate("admin.projects.access.permissionTitle")}
      >
        <AuthenticatedRecordList label={messageTranslate("admin.projects.access.permissionTitle")}>
          <For each={state.permissionRoles()}>
            {(role) => (
              <AuthenticatedRecordItem
                fields={[
                  { identifier: true, label: messageTranslate("admin.projects.roles.key"), value: role.roleId },
                  {
                    label: messageTranslate("admin.projects.access.permissionTitle"),
                    value: role.permissions.length === 0 ? "—" : role.permissions.join(", "),
                    wide: true,
                  },
                ]}
                title={role.name}
              />
            )}
          </For>
        </AuthenticatedRecordList>

        <Table
          aria-label={messageTranslate("admin.projects.access.permissionTitle")}
          class={authenticatedTableClasses.tableWide}
          tabIndex={0}
        >
          <TableHeader class={authenticatedTableClasses.header}>
            <TableRow>
              <TableHead class={authenticatedTableClasses.head}>
                {messageTranslate("admin.projects.roles.displayName")}
              </TableHead>
              <TableHead class={authenticatedTableClasses.head}>
                {messageTranslate("admin.projects.roles.key")}
              </TableHead>
              <TableHead class={authenticatedTableClasses.head}>
                {messageTranslate("admin.projects.access.permissionTitle")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <For each={state.permissionRoles()}>
              {(role) => (
                <TableRow class={authenticatedTableClasses.row}>
                  <TableCell class={`${authenticatedTableClasses.cell} font-medium`}>{role.name}</TableCell>
                  <TableCell class={authenticatedTableClasses.identifier}>{role.roleId}</TableCell>
                  <TableCell class={`${authenticatedTableClasses.cell} text-xs text-muted-foreground`}>
                    <Show when={role.permissions.length > 0} fallback="—">
                      {role.permissions.join(", ")}
                    </Show>
                  </TableCell>
                </TableRow>
              )}
            </For>
          </TableBody>
        </Table>
      </AuthenticatedSection>
    </section>
  )
}
