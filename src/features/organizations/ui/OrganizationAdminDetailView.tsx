import { mdiCancel } from "@adaptive-ds/mdi/mdiCancel.js"
import { mdiCheckCircle } from "@adaptive-ds/mdi/mdiCheckCircle.js"
import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiDelete } from "@adaptive-ds/mdi/mdiDelete.js"
import { A } from "@solidjs/router"
import { For, Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedRecordItem } from "../../../ui/authenticated/AuthenticatedRecordItem.js"
import { AuthenticatedRecordList } from "../../../ui/authenticated/AuthenticatedRecordList.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { authenticatedTableClasses } from "../../../ui/authenticated/authenticatedTableClasses.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { OrganizationMembership } from "../public/organizationMembershipSchema.js"
import type { Organization } from "../public/organizationSchema.js"
import { OrganizationAdminNotice } from "./OrganizationAdminNotice.js"
import { OrganizationAdminState } from "./OrganizationAdminState.js"
import type { OrganizationAdminStatus } from "./organizationAdminStatusSchema.js"
import { organizationAdminStatusTone } from "./organizationAdminStatusTone.js"

export function OrganizationAdminDetailView(props: {
  readonly backHref: string
  readonly error?: string
  readonly machineCredentialsHref: string
  readonly machinesHref: string
  readonly memberships: readonly OrganizationMembership[]
  readonly membershipsHref: string
  readonly name: string
  readonly notice?: string
  readonly onLifecycleSet: (status: "active" | "inactive" | "removed") => void
  readonly onNameInput: (value: string) => void
  readonly onRenameSubmit: (event: SubmitEvent) => void
  readonly onRetry: () => void
  readonly organization?: Organization
  readonly pendingId?: string
  readonly status: OrganizationAdminStatus
}) {
  return (
    <section aria-label={messageTranslate("admin.organizations.detailTitle")} class="grid min-w-0 gap-5 [&>*]:min-w-0">
      <A class="text-xs font-medium text-accent hover:underline" href={props.backHref}>
        {messageTranslate("admin.organizations.list.title")}
      </A>

      <OrganizationAdminNotice notice={props.notice} />

      <OrganizationAdminState
        emptyDetail={messageTranslate("admin.organizations.list.empty")}
        error={props.error}
        onRetry={props.onRetry}
        status={props.status}
      >
        <Show when={props.organization}>
          {(organization) => (
            <>
              <AuthenticatedSection
                actions={
                  <AuthenticatedStatus
                    label={messageTranslate(`admin.organizations.statusValue.${organization().status}`)}
                    tone={organizationAdminStatusTone(organization().status)}
                  />
                }
                padded
                title={organization().name}
              >
                <AuthenticatedFieldList
                  columns={3}
                  fields={[
                    {
                      identifier: true,
                      label: messageTranslate("admin.organizations.detail.realm"),
                      value: organization().realmId,
                    },
                    {
                      label: messageTranslate("admin.organizations.detail.created"),
                      value: localeDateFormat(organization().createdAt, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }),
                    },
                    {
                      label: messageTranslate("admin.organizations.detail.updated"),
                      value: localeDateFormat(organization().updatedAt, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }),
                    },
                  ]}
                />
              </AuthenticatedSection>

              <AuthenticatedSection
                description={messageTranslate("admin.organizations.detail.settingsDescription")}
                title={messageTranslate("admin.organizations.detail.settingsTitle")}
              >
                <form class="grid max-w-3xl gap-4 px-5 py-4" onSubmit={props.onRenameSubmit}>
                  <div class="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div class="grid min-w-0 gap-1.5">
                      <Label class="text-[0.8125rem] font-medium" for="organization-detail-name">
                        {messageTranslate("admin.organizations.list.name")}
                      </Label>
                      <AuthenticatedInput
                        id="organization-detail-name"
                        onInput={(event) => props.onNameInput(event.currentTarget.value)}
                        value={props.name}
                      />
                    </div>
                    <AuthenticatedButton
                      size="sm"
                      disabled={props.pendingId !== undefined}
                      icon={mdiContentSave}
                      type="submit"
                      variant="filledBlue"
                    >
                      {messageTranslate("common.save")}
                    </AuthenticatedButton>
                  </div>
                  <div class="flex flex-wrap gap-2 border-t border-line-subtle pt-3">
                    <Show when={organization().status !== "active"}>
                      <AuthenticatedButton
                        size="sm"
                        disabled={props.pendingId !== undefined}
                        icon={mdiCheckCircle}
                        onClick={() => props.onLifecycleSet("active")}
                        variant="outline"
                      >
                        {messageTranslate("admin.organizations.lifecycle.activate")}
                      </AuthenticatedButton>
                    </Show>
                    <Show when={organization().status === "active"}>
                      <AuthenticatedButton
                        size="sm"
                        disabled={props.pendingId !== undefined}
                        icon={mdiCancel}
                        onClick={() => props.onLifecycleSet("inactive")}
                        variant="outline"
                      >
                        {messageTranslate("admin.organizations.lifecycle.deactivate")}
                      </AuthenticatedButton>
                    </Show>
                    <Show when={organization().status !== "removed"}>
                      <AuthenticatedButton
                        size="sm"
                        disabled={props.pendingId !== undefined}
                        icon={mdiDelete}
                        onClick={() => props.onLifecycleSet("removed")}
                        variant="outlineRed"
                      >
                        {messageTranslate("admin.organizations.lifecycle.remove")}
                      </AuthenticatedButton>
                    </Show>
                  </div>
                </form>
              </AuthenticatedSection>

              <AuthenticatedSection
                actions={
                  <A class="text-xs font-medium text-accent hover:underline" href={props.membershipsHref}>
                    {messageTranslate("admin.organizations.memberships.title")}
                  </A>
                }
                title={messageTranslate("admin.organizations.memberships.title")}
              >
                <Show
                  when={props.memberships.length > 0}
                  fallback={
                    <ProductionStatePanel
                      compact
                      detail={messageTranslate("admin.organizations.memberships.empty")}
                      state="empty"
                    />
                  }
                >
                  <AuthenticatedRecordList label={messageTranslate("admin.organizations.memberships.title")}>
                    <For each={props.memberships}>
                      {(membership) => (
                        <AuthenticatedRecordItem
                          fields={[
                            {
                              label: messageTranslate("admin.organizations.memberships.roles"),
                              value: membership.roles.join(", "),
                              wide: true,
                            },
                          ]}
                          title={
                            <span class="block truncate text-[0.8125rem]" title={membership.userId}>
                              {membership.displayName?.trim() || membership.userId}
                            </span>
                          }
                        />
                      )}
                    </For>
                  </AuthenticatedRecordList>

                  <Table
                    aria-label={messageTranslate("admin.organizations.memberships.title")}
                    class={authenticatedTableClasses.tableWide}
                    tabIndex={0}
                  >
                    <TableHeader class={authenticatedTableClasses.header}>
                      <TableRow>
                        <TableHead class={authenticatedTableClasses.head}>
                          {messageTranslate("admin.organizations.memberships.user")}
                        </TableHead>
                        <TableHead class={authenticatedTableClasses.head}>
                          {messageTranslate("admin.organizations.memberships.roles")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <For each={props.memberships}>
                        {(membership) => (
                          <TableRow class={authenticatedTableClasses.row}>
                            <TableCell class={authenticatedTableClasses.cell} title={membership.userId}>
                              {membership.displayName?.trim() || membership.userId}
                            </TableCell>
                            <TableCell class={authenticatedTableClasses.cell}>{membership.roles.join(", ")}</TableCell>
                          </TableRow>
                        )}
                      </For>
                    </TableBody>
                  </Table>
                </Show>
              </AuthenticatedSection>

              <AuthenticatedSection
                actions={
                  <A class="text-xs font-medium text-accent hover:underline" href={props.machinesHref}>
                    {messageTranslate("shell.nav.machineUsers")}
                  </A>
                }
                description={messageTranslate("admin.machine.users.description")}
                title={messageTranslate("shell.nav.machineUsers")}
              >
                <div class="flex flex-wrap gap-2 px-5 py-4">
                  <A class="text-xs font-medium text-accent hover:underline" href={props.machinesHref}>
                    {messageTranslate("shell.nav.machineUsers")}
                  </A>
                  <A class="text-xs font-medium text-accent hover:underline" href={props.machineCredentialsHref}>
                    {messageTranslate("shell.nav.credentialsTokens")}
                  </A>
                </div>
              </AuthenticatedSection>
            </>
          )}
        </Show>
      </OrganizationAdminState>
    </section>
  )
}
