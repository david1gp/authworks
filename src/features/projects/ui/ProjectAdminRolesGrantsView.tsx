import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { SelectSingleNative } from "#ui/input/select/SelectSingleNative.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedRecordItem } from "../../../ui/authenticated/AuthenticatedRecordItem.js"
import { AuthenticatedRecordList } from "../../../ui/authenticated/AuthenticatedRecordList.js"
import { AuthenticatedPageBody } from "../../../ui/authenticated/AuthenticatedPageBody.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { authenticatedTableClasses } from "../../../ui/authenticated/authenticatedTableClasses.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { ProjectGrant } from "../public/projectGrantSchema.js"
import { ProjectAdminProjectContext } from "./ProjectAdminProjectContext.js"
import { ProjectAdminStateBoundary } from "./ProjectAdminStateBoundary.js"
import type { projectAdminRolesGrantsViewStateCreate } from "./projectAdminRolesGrantsViewStateCreate.js"
import { projectAdminStatusTone } from "./projectAdminStatusTone.js"

export function ProjectAdminRolesGrantsView(props: {
  readonly state: ReturnType<typeof projectAdminRolesGrantsViewStateCreate>
}) {
  const state = props.state
  const grantActions = (grant: ProjectGrant) => (
    <>
      <Show when={grant.status === "active"}>
        <Button
          disabled={state.page.pendingId() !== undefined}
          onClick={() => state.grantLifecycleSet(grant.id, "inactive")}
          size="sm"
          variant="outline"
        >
          {messageTranslate("admin.projects.lifecycle.deactivate")}
        </Button>
      </Show>
      <Show when={grant.status === "inactive"}>
        <Button
          disabled={state.page.pendingId() !== undefined}
          onClick={() => state.grantLifecycleSet(grant.id, "active")}
          size="sm"
          variant="outline"
        >
          {messageTranslate("admin.projects.lifecycle.activate")}
        </Button>
      </Show>
      <Button
        disabled={state.page.pendingId() !== undefined}
        onClick={() => state.grantDelete(grant.id)}
        size="sm"
        variant="filledRed"
      >
        {messageTranslate("common.revoke")}
      </Button>
    </>
  )
  const grantOrganizationName = (grant: ProjectGrant) => (
    <span class="inline-flex min-w-0 flex-wrap items-center gap-1.5">
      <span class="truncate">{state.page.organizationName(grant.grantedOrganizationId)}</span>
      <Show when={grant.grantedOrganizationId !== grant.organizationId}>
        <span class="rounded-full bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">
          {messageTranslate("admin.projects.access.grantedOrganization")}
        </span>
      </Show>
    </span>
  )

  return (
    <AuthenticatedPageBody>
      <ProjectAdminProjectContext page={state.page} />

      <ProjectAdminStateBoundary
        emptyDetail={messageTranslate("admin.projects.roles.empty")}
        error={state.page.error()}
        onRetry={state.page.reload}
        status={state.page.status()}
      >
        <AuthenticatedSection
          actions={
            <AuthenticatedDialog
              description={messageTranslate("admin.projects.roles.description")}
              onOpenChange={state.roleCreateOpenSet}
              open={state.roleCreateOpen()}
              title={messageTranslate("admin.projects.roles.create")}
              triggerLabel={messageTranslate("admin.projects.roles.create")}
              variant="filledBlue"
            >
              <form class="grid gap-3" onSubmit={state.roleCreateSubmit}>
                <div class="grid gap-1">
                  <Label for="role-key">{messageTranslate("admin.projects.roles.key")}</Label>
                  <Input
                    id="role-key"
                    onInput={(event) => state.roleKey.set(event.currentTarget.value)}
                    value={state.roleKey.get()}
                  />
                </div>
                <div class="grid gap-1">
                  <Label for="role-display-name">{messageTranslate("admin.projects.roles.displayName")}</Label>
                  <Input
                    id="role-display-name"
                    onInput={(event) => state.roleDisplayName.set(event.currentTarget.value)}
                    value={state.roleDisplayName.get()}
                  />
                </div>
                <div class="grid gap-1">
                  <Label for="role-group">{messageTranslate("admin.projects.roles.group")}</Label>
                  <Input
                    id="role-group"
                    onInput={(event) => state.roleGroup.set(event.currentTarget.value)}
                    value={state.roleGroup.get()}
                  />
                </div>
                <Show when={state.roleFormError()}>
                  {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
                </Show>
                <Button disabled={state.page.pendingId() !== undefined} type="submit" variant="filledBlue">
                  {messageTranslate("common.save")}
                </Button>
              </form>
            </AuthenticatedDialog>
          }
          description={messageTranslate("admin.projects.roles.description")}
          title={messageTranslate("admin.projects.roles.title")}
        >
          <Show
            when={state.page.roles().length > 0}
            fallback={
              <ProductionStatePanel compact detail={messageTranslate("admin.projects.roles.empty")} state="empty" />
            }
          >
            <AuthenticatedRecordList label={messageTranslate("admin.projects.roles.title")}>
              <For each={state.page.roles()}>
                {(role) => (
                  <AuthenticatedRecordItem
                    actions={
                      <Button
                        disabled={state.page.pendingId() !== undefined}
                        onClick={() => state.roleDelete(role.id)}
                        size="sm"
                        variant="filledRed"
                      >
                        {messageTranslate("admin.projects.lifecycle.remove")}
                      </Button>
                    }
                    fields={[
                      {
                        identifier: true,
                        label: messageTranslate("admin.projects.roles.key"),
                        value: role.key,
                      },
                      {
                        label: messageTranslate("admin.projects.roles.group"),
                        value: role.group ?? "—",
                      },
                    ]}
                    title={role.displayName}
                  />
                )}
              </For>
            </AuthenticatedRecordList>

            <Table
              aria-label={messageTranslate("admin.projects.roles.title")}
              class={authenticatedTableClasses.tableWide}
              tabIndex={0}
            >
              <TableHeader class={authenticatedTableClasses.header}>
                <TableRow>
                  <TableHead class={authenticatedTableClasses.head}>
                    {messageTranslate("admin.projects.roles.key")}
                  </TableHead>
                  <TableHead class={authenticatedTableClasses.head}>
                    {messageTranslate("admin.projects.roles.displayName")}
                  </TableHead>
                  <TableHead class={authenticatedTableClasses.head}>
                    {messageTranslate("admin.projects.roles.group")}
                  </TableHead>
                  <TableHead class={authenticatedTableClasses.head}>
                    <span class="sr-only">{messageTranslate("admin.projects.lifecycle.remove")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <For each={state.page.roles()}>
                  {(role) => (
                    <TableRow class={authenticatedTableClasses.row}>
                      <TableCell class={authenticatedTableClasses.identifier}>{role.key}</TableCell>
                      <TableCell class={`${authenticatedTableClasses.cell} font-medium`}>{role.displayName}</TableCell>
                      <TableCell class={authenticatedTableClasses.cell}>{role.group ?? "—"}</TableCell>
                      <TableCell class={authenticatedTableClasses.action}>
                        <Button
                          disabled={state.page.pendingId() !== undefined}
                          onClick={() => state.roleDelete(role.id)}
                          size="sm"
                          variant="filledRed"
                        >
                          {messageTranslate("admin.projects.lifecycle.remove")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </For>
              </TableBody>
            </Table>
          </Show>
        </AuthenticatedSection>

        <AuthenticatedSection
          actions={
            <AuthenticatedDialog
              description={messageTranslate("admin.projects.grants.description")}
              onOpenChange={state.grantCreateOpenSet}
              open={state.grantCreateOpen()}
              title={messageTranslate("admin.projects.grants.create")}
              triggerLabel={messageTranslate("admin.projects.grants.create")}
              variant="filledBlue"
            >
              <form class="grid gap-3" onSubmit={state.grantCreateSubmit}>
                <div class="grid gap-1">
                  <Label for="grant-organization">
                    {messageTranslate("admin.projects.grants.grantedOrganization")}
                  </Label>
                  <SelectSingleNative
                    getOptions={() => state.grantableOrganizations().map((organization) => organization.id)}
                    id="grant-organization"
                    valueSignal={state.grantOrganizationId}
                    valueText={(id) => state.page.organizationName(id)}
                  />
                </div>
                <fieldset class="grid gap-1.5">
                  <legend class="text-xs font-medium">{messageTranslate("admin.projects.grants.roleKeys")}</legend>
                  <For each={state.page.roles()}>
                    {(role) => (
                      <label class="flex items-center gap-2 text-sm">
                        <input
                          checked={state.grantRoleKeys.get().includes(role.key)}
                          onChange={() => state.grantRoleToggle(role.key)}
                          type="checkbox"
                        />
                        <span>{role.displayName}</span>
                        <code class="text-xs text-muted-foreground">{role.key}</code>
                      </label>
                    )}
                  </For>
                </fieldset>
                <Show when={state.grantFormError()}>
                  {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
                </Show>
                <Button disabled={state.page.pendingId() !== undefined} type="submit" variant="filledBlue">
                  {messageTranslate("common.save")}
                </Button>
              </form>
            </AuthenticatedDialog>
          }
          description={messageTranslate("admin.projects.grants.description")}
          title={messageTranslate("admin.projects.grants.title")}
        >
          <Show
            when={state.page.grants().length > 0}
            fallback={
              <ProductionStatePanel compact detail={messageTranslate("admin.projects.grants.empty")} state="empty" />
            }
          >
            <AuthenticatedRecordList label={messageTranslate("admin.projects.grants.title")}>
              <For each={state.page.grants()}>
                {(grant) => (
                  <AuthenticatedRecordItem
                    actions={grantActions(grant)}
                    fields={[
                      {
                        label: messageTranslate("admin.projects.grants.roleKeys"),
                        value: grant.roleKeys.join(", ") || "—",
                        wide: true,
                      },
                    ]}
                    status={
                      <AuthenticatedStatus
                        label={messageTranslate(`admin.projects.statusValue.${grant.status}`)}
                        tone={projectAdminStatusTone(grant.status)}
                      />
                    }
                    title={grantOrganizationName(grant)}
                  />
                )}
              </For>
            </AuthenticatedRecordList>

            <Table
              aria-label={messageTranslate("admin.projects.grants.title")}
              class={authenticatedTableClasses.tableWide}
              tabIndex={0}
            >
              <TableHeader class={authenticatedTableClasses.header}>
                <TableRow>
                  <TableHead class={authenticatedTableClasses.head}>
                    {messageTranslate("admin.projects.grants.grantedOrganization")}
                  </TableHead>
                  <TableHead class={authenticatedTableClasses.head}>
                    {messageTranslate("admin.projects.grants.roleKeys")}
                  </TableHead>
                  <TableHead class={authenticatedTableClasses.head}>
                    {messageTranslate("admin.projects.status")}
                  </TableHead>
                  <TableHead class={authenticatedTableClasses.head}>
                    <span class="sr-only">{messageTranslate("common.revoke")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <For each={state.page.grants()}>
                  {(grant) => (
                    <TableRow class={authenticatedTableClasses.row}>
                      <TableCell class={`${authenticatedTableClasses.cell} font-medium`}>
                        {grantOrganizationName(grant)}
                      </TableCell>
                      <TableCell class={`${authenticatedTableClasses.cell} max-w-xs`}>
                        {grant.roleKeys.join(", ") || "—"}
                      </TableCell>
                      <TableCell class={authenticatedTableClasses.cell}>
                        <AuthenticatedStatus
                          label={messageTranslate(`admin.projects.statusValue.${grant.status}`)}
                          tone={projectAdminStatusTone(grant.status)}
                        />
                      </TableCell>
                      <TableCell class={authenticatedTableClasses.action}>
                        <div class="flex flex-nowrap justify-end gap-1.5">{grantActions(grant)}</div>
                      </TableCell>
                    </TableRow>
                  )}
                </For>
              </TableBody>
            </Table>
          </Show>
        </AuthenticatedSection>
      </ProjectAdminStateBoundary>
    </AuthenticatedPageBody>
  )
}
