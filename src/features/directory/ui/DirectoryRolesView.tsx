import { mdiAccountCogOutline } from "@adaptive-ds/mdi/mdiAccountCogOutline.js"
import { mdiAccountEyeOutline } from "@adaptive-ds/mdi/mdiAccountEyeOutline.js"
import { mdiAccountOutline } from "@adaptive-ds/mdi/mdiAccountOutline.js"
import { mdiArrowRight } from "@adaptive-ds/mdi/mdiArrowRight.js"
import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiDelete } from "@adaptive-ds/mdi/mdiDelete.js"
import { mdiPencil } from "@adaptive-ds/mdi/mdiPencil.js"
import { mdiPlus } from "@adaptive-ds/mdi/mdiPlus.js"
import { mdiShieldCrownOutline } from "@adaptive-ds/mdi/mdiShieldCrownOutline.js"
import { A } from "@solidjs/router"
import { For, Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedChip } from "../../../ui/authenticated/AuthenticatedChip.js"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedOptionCard } from "../../../ui/authenticated/AuthenticatedOptionCard.js"
import { AuthenticatedPageBody } from "../../../ui/authenticated/AuthenticatedPageBody.js"
import { AuthenticatedRecordItem } from "../../../ui/authenticated/AuthenticatedRecordItem.js"
import { AuthenticatedRecordList } from "../../../ui/authenticated/AuthenticatedRecordList.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedSelect } from "../../../ui/authenticated/AuthenticatedSelect.js"
import { AuthenticatedSkeleton } from "../../../ui/authenticated/AuthenticatedSkeleton.js"
import { authenticatedTableClasses } from "../../../ui/authenticated/authenticatedTableClasses.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { OrganizationRoleId } from "../../organizations/public/organizationRoleIdSchema.js"
import type { DirectoryRolesProjectEntry } from "./directoryRolesAdapter.js"
import { directoryRolesMemberCountLabel } from "./directoryRolesMemberCountLabel.js"
import type { DirectoryRolesViewState } from "./directoryRolesViewStateCreate.js"

const organizationRoleIcons: Record<OrganizationRoleId, string> = {
  admin: mdiAccountCogOutline,
  guest: mdiAccountEyeOutline,
  member: mdiAccountOutline,
  owner: mdiShieldCrownOutline,
}

const organizationRoleBullets: Record<OrganizationRoleId, readonly string[]> = {
  admin: [
    messageTranslate("admin.roles.orgRole.admin.bullet1"),
    messageTranslate("admin.roles.orgRole.admin.bullet2"),
    messageTranslate("admin.roles.orgRole.admin.bullet3"),
  ],
  guest: [messageTranslate("admin.roles.orgRole.guest.bullet1"), messageTranslate("admin.roles.orgRole.guest.bullet2")],
  member: [
    messageTranslate("admin.roles.orgRole.member.bullet1"),
    messageTranslate("admin.roles.orgRole.member.bullet2"),
    messageTranslate("admin.roles.orgRole.member.bullet3"),
  ],
  owner: [
    messageTranslate("admin.roles.orgRole.owner.bullet1"),
    messageTranslate("admin.roles.orgRole.owner.bullet2"),
    messageTranslate("admin.roles.orgRole.owner.bullet3"),
  ],
}

/** Shared stateless roles view: organization cards plus per-project role tables. */
export function DirectoryRolesView(props: { readonly state: DirectoryRolesViewState }) {
  const state = props.state
  const page = () => state.page

  const roleActions = (entry: DirectoryRolesProjectEntry, roleId: string) => (
    <Show when={page().canManage() && entry.owned}>
      <AuthenticatedButton
        disabled={page().pendingId() !== undefined}
        icon={mdiPencil}
        onClick={() => state.editRoleOpenSet(entry.project.id, roleId)(true)}
        size="sm"
        variant="outline"
      >
        {messageTranslate("admin.roles.edit")}
      </AuthenticatedButton>
      <AuthenticatedButton
        disabled={page().pendingId() !== undefined}
        icon={mdiDelete}
        onClick={() => void page().roleDelete(entry.project.id, roleId)}
        size="sm"
        variant="outlineRed"
      >
        {messageTranslate("admin.roles.delete")}
      </AuthenticatedButton>
    </Show>
  )

  const projectGroup = (entry: DirectoryRolesProjectEntry) => (
    <AuthenticatedSection
      actions={
        <Show when={page().canManage() && entry.owned}>
          <AuthenticatedButton
            icon={mdiPlus}
            onClick={() => state.newRoleOpenSet(entry.project.id)(true)}
            size="sm"
            variant="filledBlue"
          >
            {messageTranslate("admin.roles.projects.newRole")}
          </AuthenticatedButton>
        </Show>
      }
      label={entry.project.name}
      title={entry.project.name}
    >
      <div class="flex flex-wrap items-center gap-2 px-5 pt-4">
        <AuthenticatedChip
          label={messageTranslate(entry.owned ? "admin.roles.projects.owned" : "admin.roles.projects.shared")}
          tone={entry.owned ? "accent" : "neutral"}
        />
        <A
          class="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
          href={state.projectHref(entry.project.id)}
        >
          {entry.project.name}
          <Icon aria-hidden="true" class="size-4" path={mdiArrowRight} />
        </A>
      </div>
      <Show
        when={entry.roles.length > 0}
        fallback={
          <div class="px-5 py-4">
            <ProductionStatePanel compact detail={messageTranslate("admin.roles.rolesEmpty")} state="empty" />
          </div>
        }
      >
        <AuthenticatedRecordList label={entry.project.name}>
          <For each={entry.roles}>
            {(role) => (
              <AuthenticatedRecordItem
                actions={roleActions(entry, role.id)}
                fields={[
                  {
                    identifier: true,
                    label: messageTranslate("admin.roles.dialog.key"),
                    value: role.key,
                  },
                  {
                    label: messageTranslate("admin.roles.dialog.group"),
                    value: role.group ?? messageTranslate("admin.roles.groupFallback"),
                  },
                ]}
                title={role.displayName}
              />
            )}
          </For>
        </AuthenticatedRecordList>

        <Table aria-label={entry.project.name} class={authenticatedTableClasses.tableWide} tabIndex={0}>
          <TableHeader class={authenticatedTableClasses.header}>
            <TableRow>
              <TableHead class={authenticatedTableClasses.head}>
                {messageTranslate("admin.roles.dialog.displayName")}
              </TableHead>
              <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.roles.dialog.key")}</TableHead>
              <TableHead class={authenticatedTableClasses.head}>
                {messageTranslate("admin.roles.dialog.group")}
              </TableHead>
              <TableHead class={authenticatedTableClasses.head}>
                <span class="sr-only">{messageTranslate("admin.roles.edit")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <For each={entry.roles}>
              {(role) => (
                <TableRow class={authenticatedTableClasses.row}>
                  <TableCell class={`${authenticatedTableClasses.cell} font-medium`}>{role.displayName}</TableCell>
                  <TableCell class={authenticatedTableClasses.identifier} title={role.key}>
                    {role.key}
                  </TableCell>
                  <TableCell class={authenticatedTableClasses.cell}>
                    {role.group ?? messageTranslate("admin.roles.groupFallback")}
                  </TableCell>
                  <TableCell class={authenticatedTableClasses.action}>
                    <div class="flex flex-nowrap justify-end gap-1.5">{roleActions(entry, role.id)}</div>
                  </TableCell>
                </TableRow>
              )}
            </For>
          </TableBody>
        </Table>
      </Show>
    </AuthenticatedSection>
  )

  return (
    <AuthenticatedPageBody>
      <p class="max-w-3xl text-sm text-muted-foreground">{messageTranslate("admin.roles.description")}</p>

      <Show
        when={page().status() !== "loading"}
        fallback={
          <div aria-label={messageTranslate("common.loading")} class="grid gap-4" role="status">
            <AuthenticatedSkeleton class="h-9 w-48" />
            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <For each={[0, 1, 2, 3]}>{(index) => <AuthenticatedSkeleton class="h-44" index={index} />}</For>
            </div>
            <AuthenticatedSkeleton class="h-64" />
          </div>
        }
      >
        <Show
          when={page().status() === "ready" || page().status() === "empty"}
          fallback={
            <ProductionStatePanel
              detail={page().error()}
              onRetry={page().status() === "error" ? page().reload : undefined}
              state={
                page().status() === "permission-denied" || page().status() === "cross-tenant" ? "inaccessible" : "error"
              }
              title={messageTranslate("admin.roles.title")}
            />
          }
        >
          <AuthenticatedSection
            description={messageTranslate("admin.roles.organizationRoles.description")}
            label={messageTranslate("admin.roles.organizationRoles.title")}
            title={messageTranslate("admin.roles.organizationRoles.title")}
          >
            <div class="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
              <For each={page().organizationRoles()}>
                {(role) => (
                  <A
                    aria-label={`${role.name} · ${directoryRolesMemberCountLabel(page().memberCount(role.id) ?? 0)}`}
                    class="block rounded-panel transition-shadow hover:shadow-panel focus-visible:outline-2 focus-visible:outline-accent"
                    href={state.usersHref(role.id)}
                  >
                    <AuthenticatedOptionCard
                      bullets={[...organizationRoleBullets[role.id]]}
                      description={messageTranslate(`admin.roles.orgRole.${role.id}.description`)}
                      icon={organizationRoleIcons[role.id]}
                      title={`${role.name} · ${directoryRolesMemberCountLabel(page().memberCount(role.id) ?? 0)}`}
                    />
                  </A>
                )}
              </For>
            </div>
          </AuthenticatedSection>

          <Show
            when={page().entries().length > 0}
            fallback={
              <AuthenticatedSection
                label={messageTranslate("admin.roles.projects.title")}
                title={messageTranslate("admin.roles.projects.title")}
              >
                <div class="px-5 py-4">
                  <ProductionStatePanel
                    detail={messageTranslate("admin.roles.empty.description")}
                    state="empty"
                    title={messageTranslate("admin.roles.empty.title")}
                  />
                  <div class="mt-3 flex justify-center">
                    <A
                      class="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-3.5 py-2 text-sm font-medium hover:border-line-strong"
                      href={state.projectsHref()}
                    >
                      <Icon aria-hidden="true" class="size-4" path={mdiArrowRight} />
                      {messageTranslate("admin.roles.empty.createProjects")}
                    </A>
                  </div>
                </div>
              </AuthenticatedSection>
            }
          >
            <For each={page().entries()}>{(entry) => projectGroup(entry)}</For>
          </Show>

          <AuthenticatedDialog
            description={messageTranslate(
              state.isEditing() ? "admin.roles.dialog.editDescription" : "admin.roles.dialog.newDescription",
            )}
            onOpenChange={(open) => {
              if (!open) state.dialogClose()
            }}
            open={state.dialogOpen()}
            title={messageTranslate(state.isEditing() ? "admin.roles.dialog.editTitle" : "admin.roles.dialog.newTitle")}
          >
            <form class="grid gap-4" onSubmit={(event) => void state.dialogSubmit(event)}>
              <Show when={!state.isEditing() && state.dialogEntry() === undefined}>
                <div class="grid gap-1.5">
                  <Label class="text-[0.8125rem] font-medium" for="role-project">
                    {messageTranslate("admin.roles.dialog.project")}
                  </Label>
                  <AuthenticatedSelect
                    getOptions={() =>
                      page()
                        .entries()
                        .map((entry) => entry.project.id)
                    }
                    id="role-project"
                    valueSignal={state.projectId}
                    valueText={(id) => page().entry(id)?.project.name ?? id}
                  />
                </div>
              </Show>
              <div class="grid gap-1.5">
                <Label class="text-[0.8125rem] font-medium" for="role-display-name">
                  {messageTranslate("admin.roles.dialog.displayName")}
                </Label>
                <AuthenticatedInput
                  id="role-display-name"
                  onInput={(event) => state.displayNameInput(event.currentTarget.value)}
                  value={state.displayName.get()}
                />
              </div>
              <div class="grid gap-1.5">
                <Label class="text-[0.8125rem] font-medium" for="role-key">
                  {messageTranslate("admin.roles.dialog.key")}
                </Label>
                <AuthenticatedInput
                  aria-describedby="role-key-hint"
                  disabled={state.isEditing()}
                  id="role-key"
                  onInput={(event) => {
                    state.keyTouched.set(true)
                    state.key.set(event.currentTarget.value)
                  }}
                  value={state.key.get()}
                />
                <p class="text-xs text-muted-foreground" id="role-key-hint">
                  {messageTranslate("admin.roles.dialog.keyHint")}
                </p>
              </div>
              <div class="grid gap-1.5">
                <Label class="text-[0.8125rem] font-medium" for="role-group">
                  {messageTranslate("admin.roles.dialog.group")}
                </Label>
                <AuthenticatedInput
                  id="role-group"
                  onInput={(event) => state.group.set(event.currentTarget.value)}
                  value={state.group.get()}
                />
              </div>
              <Show when={state.formError()}>
                {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
              </Show>
              <div class="flex justify-end gap-2">
                <AuthenticatedButton
                  disabled={page().pendingId() !== undefined}
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
      </Show>
    </AuthenticatedPageBody>
  )
}
