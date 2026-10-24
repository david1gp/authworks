import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiDelete } from "@adaptive-ds/mdi/mdiDelete.js"
import { mdiPlus } from "@adaptive-ds/mdi/mdiPlus.js"
import { Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedChip } from "../../../ui/authenticated/AuthenticatedChip.js"
import { AuthenticatedDataTable } from "../../../ui/authenticated/AuthenticatedDataTable.js"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedEmptyState } from "../../../ui/authenticated/AuthenticatedEmptyState.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { ProjectRole } from "../public/projectRoleSchema.js"
import type { projectAdminRolesTabStateCreate } from "./projectAdminRolesTabStateCreate.js"

/** Roles tab: project roles with create dialog and delete actions. */
export function ProjectDetailRolesTab(props: {
  readonly owned: boolean
  readonly state: ReturnType<typeof projectAdminRolesTabStateCreate>
}) {
  const state = props.state
  const columns = () => [
    {
      cell: (role: ProjectRole) => (
        <span class="flex flex-wrap items-center gap-1.5">
          <span class="font-medium">{role.displayName}</span>
          <AuthenticatedChip label={role.key} tone="neutral" />
        </span>
      ),
      header: messageTranslate("admin.projects.roles.displayName"),
      key: "displayName",
    },
    {
      cell: (role: ProjectRole) => <span class="font-mono text-[0.8125rem]">{role.key}</span>,
      header: messageTranslate("admin.projects.roles.key"),
      key: "key",
    },
    {
      cell: (role: ProjectRole) => role.group ?? "—",
      header: messageTranslate("admin.projects.roles.group"),
      key: "group",
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
              description={messageTranslate("admin.projects.roles.description")}
              onOpenChange={state.createOpenSet}
              open={state.createOpen()}
              title={messageTranslate("admin.projects.roles.create")}
              trigger={
                <AuthenticatedButton icon={mdiPlus} variant="filledBlue">
                  {messageTranslate("admin.projects.roles.create")}
                </AuthenticatedButton>
              }
            >
              <form class="grid gap-4" onSubmit={(event) => void state.createSubmit(event)}>
                <div class="grid gap-1.5">
                  <Label class="text-[0.8125rem] font-medium" for="project-role-key">
                    {messageTranslate("admin.projects.roles.key")}
                  </Label>
                  <AuthenticatedInput
                    id="project-role-key"
                    onInput={(event) => state.roleKey.set(event.currentTarget.value)}
                    value={state.roleKey.get()}
                  />
                </div>
                <div class="grid gap-1.5">
                  <Label class="text-[0.8125rem] font-medium" for="project-role-display-name">
                    {messageTranslate("admin.projects.roles.displayName")}
                  </Label>
                  <AuthenticatedInput
                    id="project-role-display-name"
                    onInput={(event) => state.roleDisplayName.set(event.currentTarget.value)}
                    value={state.roleDisplayName.get()}
                  />
                </div>
                <div class="grid gap-1.5">
                  <Label class="text-[0.8125rem] font-medium" for="project-role-group">
                    {messageTranslate("admin.projects.roles.group")}
                  </Label>
                  <AuthenticatedInput
                    id="project-role-group"
                    onInput={(event) => state.roleGroup.set(event.currentTarget.value)}
                    value={state.roleGroup.get()}
                  />
                </div>
                <Show when={state.formError()}>
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
        description={messageTranslate("admin.projects.roles.description")}
        title={messageTranslate("admin.projects.roles.title")}
      >
        <Show
          when={state.page.roles().length > 0}
          fallback={
            <AuthenticatedEmptyState
              actions={
                <Show when={props.owned}>
                  <AuthenticatedButton icon={mdiPlus} onClick={() => state.createOpenSet(true)} variant="filledBlue">
                    {messageTranslate("admin.projects.roles.create")}
                  </AuthenticatedButton>
                </Show>
              }
              description={messageTranslate("admin.projects.roles.empty")}
              title={messageTranslate("admin.projects.roles.title")}
            />
          }
        >
          <AuthenticatedDataTable
            caption={messageTranslate("admin.projects.roles.title")}
            columns={
              props.owned
                ? [
                    ...columns(),
                    {
                      align: "end" as const,
                      cell: (role: ProjectRole) => (
                        <AuthenticatedButton
                          disabled={state.page.pendingId() !== undefined}
                          icon={mdiDelete}
                          onClick={() => state.roleDelete(role.id)}
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
                : columns()
            }
            rowKey={(role) => role.id}
            rows={state.page.roles()}
          />
        </Show>
      </AuthenticatedSection>
    </div>
  )
}
