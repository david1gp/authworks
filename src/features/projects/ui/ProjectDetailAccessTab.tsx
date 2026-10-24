import { mdiCancel } from "@adaptive-ds/mdi/mdiCancel.js"
import { mdiCheckCircle } from "@adaptive-ds/mdi/mdiCheckCircle.js"
import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiDelete } from "@adaptive-ds/mdi/mdiDelete.js"
import { mdiPlus } from "@adaptive-ds/mdi/mdiPlus.js"
import { For, Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedChip } from "../../../ui/authenticated/AuthenticatedChip.js"
import { AuthenticatedDataTable } from "../../../ui/authenticated/AuthenticatedDataTable.js"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedEmptyState } from "../../../ui/authenticated/AuthenticatedEmptyState.js"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedSelect } from "../../../ui/authenticated/AuthenticatedSelect.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { authenticatedControlClasses } from "../../../ui/authenticated/authenticatedControlClasses.js"
import type { AuthenticatedDataTableColumn } from "../../../ui/authenticated/authenticatedDataTableColumn.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { ProjectGrant } from "../public/projectGrantSchema.js"
import type { ProjectUserAssignment } from "../public/projectUserAssignmentSchema.js"
import { projectAdminStatusTone } from "./projectAdminStatusTone.js"
import type { projectAdminAccessTabStateCreate } from "./projectDetailAccessTabStateCreate.js"

/** Access tab: organization grants, direct user assignments, and the effective-access panel. */
export function ProjectDetailAccessTab(props: {
  readonly owned: boolean
  readonly state: ReturnType<typeof projectAdminAccessTabStateCreate>
}) {
  const state = props.state
  const grantActions = (grant: ProjectGrant) => (
    <>
      <Show when={grant.status === "active"}>
        <AuthenticatedButton
          disabled={state.page.pendingId() !== undefined}
          icon={mdiCancel}
          onClick={() => state.grantLifecycleSet(grant.id, "inactive")}
          size="sm"
          variant="outline"
        >
          {messageTranslate("admin.projects.lifecycle.deactivate")}
        </AuthenticatedButton>
      </Show>
      <Show when={grant.status === "inactive"}>
        <AuthenticatedButton
          disabled={state.page.pendingId() !== undefined}
          icon={mdiCheckCircle}
          onClick={() => state.grantLifecycleSet(grant.id, "active")}
          size="sm"
          variant="outline"
        >
          {messageTranslate("admin.projects.lifecycle.activate")}
        </AuthenticatedButton>
      </Show>
      <AuthenticatedButton
        disabled={state.page.pendingId() !== undefined}
        icon={mdiDelete}
        onClick={() => state.grantDelete(grant.id)}
        size="sm"
        variant="outlineRed"
      >
        {messageTranslate("common.revoke")}
      </AuthenticatedButton>
    </>
  )
  const grantOrganizationName = (grant: ProjectGrant) => (
    <span class="inline-flex min-w-0 flex-wrap items-center gap-1.5">
      <span class="truncate" title={state.page.organizationName(grant.grantedOrganizationId)}>
        {state.page.organizationName(grant.grantedOrganizationId)}
      </span>
      <Show when={grant.grantedOrganizationId !== grant.organizationId}>
        <AuthenticatedChip label={messageTranslate("admin.projects.access.grantedOrganization")} tone="neutral" />
      </Show>
    </span>
  )
  const grantColumns: AuthenticatedDataTableColumn<ProjectGrant>[] = [
    {
      cell: (grant) => grantOrganizationName(grant),
      header: messageTranslate("admin.projects.grants.grantedOrganization"),
      key: "organization",
    },
    {
      cell: (grant) => <span class="font-mono text-[0.8125rem]">{grant.roleKeys.join(", ") || "—"}</span>,
      header: messageTranslate("admin.projects.grants.roleKeys"),
      key: "roles",
    },
    {
      cell: (grant) => (
        <AuthenticatedStatus
          label={messageTranslate(`admin.projects.statusValue.${grant.status}`)}
          tone={projectAdminStatusTone(grant.status)}
        />
      ),
      header: messageTranslate("admin.projects.status"),
      key: "status",
    },
  ]
  const ownedGrantColumns: AuthenticatedDataTableColumn<ProjectGrant>[] = [
    ...grantColumns,
    {
      align: "end",
      cell: (grant) => <div class="flex flex-nowrap justify-end gap-1.5">{grantActions(grant)}</div>,
      header: messageTranslate("common.revoke"),
      key: "actions",
    },
  ]
  const assignmentColumns: AuthenticatedDataTableColumn<ProjectUserAssignment>[] = [
    {
      cell: (assignment) => <span class="font-mono text-[0.8125rem]">{assignment.userId}</span>,
      header: messageTranslate("admin.projects.assignments.user"),
      key: "user",
    },
    {
      cell: (assignment) => (
        <span class="flex flex-wrap gap-1">
          <For each={assignment.roleKeys}>{(roleKey) => <AuthenticatedChip label={roleKey} tone="accent" />}</For>
        </span>
      ),
      header: messageTranslate("admin.projects.assignments.user"),
      key: "roles",
    },
  ]
  const ownedAssignmentColumns: AuthenticatedDataTableColumn<ProjectUserAssignment>[] = [
    ...assignmentColumns,
    {
      align: "end",
      cell: (assignment) => (
        <AuthenticatedButton
          disabled={state.page.pendingId() !== undefined}
          icon={mdiDelete}
          onClick={() => state.assignRemove(assignment.id)}
          size="sm"
          variant="outlineRed"
        >
          {messageTranslate("admin.projects.lifecycle.remove")}
        </AuthenticatedButton>
      ),
      header: messageTranslate("admin.projects.lifecycle.remove"),
      key: "actions",
    },
  ]

  return (
    <div class="grid min-w-0 gap-5 [&>*]:min-w-0">
      <Show when={state.page.notice()}>
        {(name) => <AuthenticatedNotice message={messageTranslate("admin.projects.saved", { name: name() })} />}
      </Show>

      <AuthenticatedSection
        actions={
          <Show when={props.owned}>
            <AuthenticatedDialog
              description={messageTranslate("admin.projects.grants.description")}
              onOpenChange={state.grantRoleOpenSet}
              open={state.grantRoleOpen()}
              title={messageTranslate("admin.projects.grants.create")}
              triggerIcon={mdiPlus}
              triggerLabel={messageTranslate("admin.projects.grants.create")}
              variant="filledBlue"
            >
              <form class="grid gap-4" onSubmit={(event) => void state.grantRoleSubmit(event)}>
                <div class="grid gap-1.5">
                  <Label class="text-[0.8125rem] font-medium" for="grant-organization">
                    {messageTranslate("admin.projects.grants.grantedOrganization")}
                  </Label>
                  <AuthenticatedSelect
                    getOptions={() => state.grantableOrganizations().map((organization) => organization.id)}
                    id="grant-organization"
                    valueSignal={state.grantOrganizationId}
                    valueText={(id) => state.page.organizationName(id)}
                  />
                </div>
                <fieldset class="grid gap-3 rounded-control border border-line bg-muted/40 p-4">
                  <legend class="px-1 text-[0.8125rem] font-medium">
                    {messageTranslate("admin.projects.access.selectRoles")}
                  </legend>
                  <For each={state.page.roles()}>
                    {(role) => (
                      <label class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <input
                          checked={state.grantRoleKeys.get().includes(role.key)}
                          class={authenticatedControlClasses.checkbox}
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
                <div class="flex justify-end gap-2">
                  <AuthenticatedButton
                    disabled={state.page.pendingId() !== undefined}
                    icon={mdiContentSave}
                    type="submit"
                    variant="filledBlue"
                  >
                    {messageTranslate("common.save")}
                  </AuthenticatedButton>
                </div>
              </form>
            </AuthenticatedDialog>
          </Show>
        }
        description={messageTranslate("admin.projects.access.organizationDescription")}
        title={messageTranslate("admin.projects.access.organizationTitle")}
      >
        <Show
          when={state.page.grants().length > 0}
          fallback={
            <AuthenticatedEmptyState
              description={messageTranslate("admin.projects.grants.empty")}
              title={messageTranslate("admin.projects.grants.title")}
            />
          }
        >
          <AuthenticatedDataTable
            caption={messageTranslate("admin.projects.access.organizationTitle")}
            columns={props.owned ? ownedGrantColumns : grantColumns}
            rowKey={(grant) => grant.id}
            rows={state.page.grants()}
          />
        </Show>
      </AuthenticatedSection>

      <AuthenticatedSection
        actions={
          <Show when={props.owned}>
            <AuthenticatedDialog
              description={messageTranslate("admin.projects.assignments.description")}
              onOpenChange={state.assignOpenSet}
              open={state.assignOpen()}
              title={messageTranslate("admin.projects.assignments.create")}
              triggerIcon={mdiPlus}
              triggerLabel={messageTranslate("admin.projects.assignments.create")}
              variant="filledBlue"
            >
              <form class="grid gap-4" onSubmit={(event) => void state.assignSubmit(event)}>
                <div class="grid gap-1.5">
                  <Label class="text-[0.8125rem] font-medium" for="assignment-user">
                    {messageTranslate("admin.projects.assignments.user")}
                  </Label>
                  <AuthenticatedInput
                    id="assignment-user"
                    onInput={(event) => state.assignUserId.set(event.currentTarget.value)}
                    value={state.assignUserId.get()}
                  />
                </div>
                <fieldset class="grid gap-3 rounded-control border border-line bg-muted/40 p-4">
                  <legend class="px-1 text-[0.8125rem] font-medium">
                    {messageTranslate("admin.projects.access.selectRoles")}
                  </legend>
                  <For each={state.page.roles()}>
                    {(role) => (
                      <label class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <input
                          checked={state.assignRoleKeys.get().includes(role.key)}
                          class={authenticatedControlClasses.checkbox}
                          onChange={() => state.assignRoleToggle(role.key)}
                          type="checkbox"
                        />
                        <span>{role.displayName}</span>
                        <code class="text-xs text-muted-foreground">{role.key}</code>
                      </label>
                    )}
                  </For>
                </fieldset>
                <Show when={state.assignFormError()}>
                  {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
                </Show>
                <div class="flex justify-end gap-2">
                  <AuthenticatedButton
                    disabled={state.page.pendingId() !== undefined}
                    icon={mdiContentSave}
                    type="submit"
                    variant="filledBlue"
                  >
                    {messageTranslate("common.save")}
                  </AuthenticatedButton>
                </div>
              </form>
            </AuthenticatedDialog>
          </Show>
        }
        description={messageTranslate("admin.projects.assignments.description")}
        title={messageTranslate("admin.projects.assignments.title")}
      >
        <Show
          when={state.page.assignments().length > 0}
          fallback={
            <AuthenticatedEmptyState
              description={messageTranslate("admin.projects.assignments.empty")}
              title={messageTranslate("admin.projects.assignments.title")}
            />
          }
        >
          <AuthenticatedDataTable
            caption={messageTranslate("admin.projects.assignments.title")}
            columns={props.owned ? ownedAssignmentColumns : assignmentColumns}
            rowKey={(assignment) => assignment.id}
            rows={state.page.assignments()}
          />
        </Show>
      </AuthenticatedSection>

      <AuthenticatedSection
        class="border-accent/20 bg-accent-soft"
        description={messageTranslate("admin.projects.access.description")}
        padded
        title={messageTranslate("admin.projects.access.title")}
      >
        <AuthenticatedFieldList
          fields={[
            {
              label: messageTranslate("admin.projects.access.roleKeys"),
              value: (
                <span class="flex flex-wrap gap-1.5">
                  <For each={state.page.access()?.roleKeys ?? []}>
                    {(roleKey) => <AuthenticatedChip label={roleKey} tone="accent" />}
                  </For>
                  <Show when={(state.page.access()?.roleKeys ?? []).length === 0}>
                    <span class="text-muted-foreground">{messageTranslate("admin.projects.access.empty")}</span>
                  </Show>
                </span>
              ),
            },
            {
              label: messageTranslate("admin.projects.access.grantedOrganization"),
              value: (
                <Show fallback="—" when={state.page.access()?.grantedOrganizationId}>
                  {(organizationId) => state.page.organizationName(organizationId())}
                </Show>
              ),
            },
          ]}
        />
      </AuthenticatedSection>

      <AuthenticatedSection
        description={messageTranslate("admin.projects.access.permissionDescription")}
        title={messageTranslate("admin.projects.access.permissionTitle")}
      >
        <AuthenticatedDataTable
          caption={messageTranslate("admin.projects.access.permissionTitle")}
          columns={[
            {
              cell: (role) => <span class="font-medium">{role.name}</span>,
              header: messageTranslate("admin.projects.roles.displayName"),
              key: "name",
            },
            {
              cell: (role) => <span class="font-mono text-[0.8125rem]">{role.roleId}</span>,
              header: messageTranslate("admin.projects.roles.key"),
              key: "key",
            },
            {
              cell: (role) => (role.permissions.length === 0 ? "—" : role.permissions.join(", ")),
              header: messageTranslate("admin.projects.access.permissionTitle"),
              key: "permissions",
            },
          ]}
          rowKey={(role) => role.roleId}
          rows={state.page.permissionRoles()}
        />
      </AuthenticatedSection>
    </div>
  )
}
