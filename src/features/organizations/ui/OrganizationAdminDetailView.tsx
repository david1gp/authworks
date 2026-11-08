import { mdiCancel } from "@adaptive-ds/mdi/mdiCancel.js"
import { mdiCheckCircle } from "@adaptive-ds/mdi/mdiCheckCircle.js"
import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiDelete } from "@adaptive-ds/mdi/mdiDelete.js"
import { A } from "@solidjs/router"
import { For, Show } from "solid-js"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedCopyableId } from "../../../ui/authenticated/AuthenticatedCopyableId.js"
import { AuthenticatedDetailHeader } from "../../../ui/authenticated/AuthenticatedDetailHeader.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedRecordItem } from "../../../ui/authenticated/AuthenticatedRecordItem.js"
import { AuthenticatedRecordList } from "../../../ui/authenticated/AuthenticatedRecordList.js"
import { AuthenticatedRelativeTime } from "../../../ui/authenticated/AuthenticatedRelativeTime.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedSettingsList } from "../../../ui/authenticated/AuthenticatedSettingsList.js"
import { AuthenticatedSettingsRow } from "../../../ui/authenticated/AuthenticatedSettingsRow.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { authenticatedTableClasses } from "../../../ui/authenticated/authenticatedTableClasses.js"
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
  readonly onSlugInput: (value: string) => void
  readonly onSlugSubmit: (event: SubmitEvent) => void
  readonly organization?: Organization
  readonly pendingId?: string
  readonly slug: string
  readonly status: OrganizationAdminStatus
}) {
  return (
    <section aria-label={messageTranslate("admin.organizations.detailTitle")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
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
              <AuthenticatedDetailHeader
                backHref={props.backHref}
                backLabel={messageTranslate("admin.organizations.list.title")}
                title={organization().name}
                badges={
                  <AuthenticatedStatus
                    label={messageTranslate(`admin.organizations.statusValue.${organization().status}`)}
                    tone={organizationAdminStatusTone(organization().status)}
                  />
                }
                facts={[
                  {
                    label: "ID",
                    value: (
                      <AuthenticatedCopyableId
                        label={messageTranslate("admin.redesign.id")}
                        value={organization().id}
                      />
                    ),
                  },
                  {
                    label: messageTranslate("admin.organizations.detail.realm"),
                    value: (
                      <AuthenticatedCopyableId
                        label={messageTranslate("admin.organizations.detail.realm")}
                        value={organization().realmId}
                      />
                    ),
                  },
                  {
                    label: messageTranslate("admin.organizations.detail.created"),
                    value: <AuthenticatedRelativeTime value={organization().createdAt} />,
                  },
                  {
                    label: messageTranslate("admin.organizations.detail.updated"),
                    value: <AuthenticatedRelativeTime value={organization().updatedAt} />,
                  },
                ]}
              />

              <AuthenticatedSection
                description={messageTranslate("admin.organizations.detail.settingsDescription")}
                title={messageTranslate("admin.organizations.detail.settingsTitle")}
              >
                <form class="grid gap-3 px-4 py-3" onSubmit={props.onRenameSubmit}>
                  <AuthenticatedSettingsList>
                    <AuthenticatedSettingsRow
                      label={messageTranslate("admin.organizations.list.name")}
                      htmlFor="organization-detail-name"
                    >
                      <div class="flex items-center gap-2">
                        <AuthenticatedInput
                          id="organization-detail-name"
                          onInput={(event) => props.onNameInput(event.currentTarget.value)}
                          value={props.name}
                        />
                        <AuthenticatedButton
                          disabled={props.pendingId !== undefined}
                          icon={mdiContentSave}
                          type="submit"
                          variant="filledBlue"
                        >
                          {messageTranslate("common.save")}
                        </AuthenticatedButton>
                      </div>
                    </AuthenticatedSettingsRow>
                  </AuthenticatedSettingsList>
                </form>
                <form class="grid gap-3 px-4 py-3" onSubmit={props.onSlugSubmit}>
                  <AuthenticatedSettingsList>
                    <AuthenticatedSettingsRow
                      label={messageTranslate("admin.teams.slug")}
                      htmlFor="organization-detail-slug"
                    >
                      <div class="grid gap-1.5">
                        <div class="flex items-center gap-2">
                          <AuthenticatedInput
                            id="organization-detail-slug"
                            onInput={(event) => props.onSlugInput(event.currentTarget.value)}
                            value={props.slug}
                          />
                          <AuthenticatedButton
                            disabled={props.pendingId !== undefined}
                            icon={mdiContentSave}
                            type="submit"
                            variant="filledBlue"
                          >
                            {messageTranslate("common.save")}
                          </AuthenticatedButton>
                        </div>
                        <p class="text-xs text-muted-foreground">{messageTranslate("admin.teams.slugHint")}</p>
                      </div>
                    </AuthenticatedSettingsRow>
                  </AuthenticatedSettingsList>
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
                              {membership.displayName?.trim() || membership.email || membership.userId}
                              <Show when={membership.email}>
                                <span class="ml-2 text-xs font-normal text-muted-foreground">{membership.email}</span>
                              </Show>
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
                              {membership.displayName?.trim() || membership.email || membership.userId}
                              <Show when={membership.email}>
                                <span class="ml-2 text-xs font-normal text-muted-foreground">{membership.email}</span>
                              </Show>
                            </TableCell>
                            <TableCell class={authenticatedTableClasses.cell}>
                              <For each={membership.roles}>
                                {(role) => (
                                  <span class="mr-1 inline-block rounded-control border border-line-subtle px-2 py-0.5 text-xs">
                                    {role}
                                  </span>
                                )}
                              </For>
                            </TableCell>
                          </TableRow>
                        )}
                      </For>
                    </TableBody>
                  </Table>
                </Show>
              </AuthenticatedSection>

              <AuthenticatedSection title={messageTranslate("shell.nav.machineUsers")}>
                <div class="flex flex-wrap gap-2 px-4 py-3">
                  <A class="text-xs font-medium text-accent hover:underline" href={props.machinesHref}>
                    {messageTranslate("shell.nav.machineUsers")}
                  </A>
                  <A class="text-xs font-medium text-accent hover:underline" href={props.machineCredentialsHref}>
                    {messageTranslate("shell.nav.credentialsTokens")}
                  </A>
                </div>
              </AuthenticatedSection>
              <AuthenticatedSection title={messageTranslate("admin.configuration.dangerTitle")}>
                <div class="flex flex-wrap gap-2 px-4 py-2">
                  <Show when={organization().status !== "active"}>
                    <AuthenticatedButton
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
                      disabled={props.pendingId !== undefined}
                      icon={mdiDelete}
                      onClick={() => props.onLifecycleSet("removed")}
                      variant="outlineRed"
                    >
                      {messageTranslate("admin.organizations.lifecycle.remove")}
                    </AuthenticatedButton>
                  </Show>
                </div>
              </AuthenticatedSection>
            </>
          )}
        </Show>
      </OrganizationAdminState>
    </section>
  )
}
