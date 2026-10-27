import { A, useLocation, useNavigate } from "@solidjs/router"
import { For, Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { AuthenticatedAvatar } from "../../../ui/authenticated/AuthenticatedAvatar.js"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedChip } from "../../../ui/authenticated/AuthenticatedChip.js"
import { AuthenticatedDataTable } from "../../../ui/authenticated/AuthenticatedDataTable.js"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedEmptyState } from "../../../ui/authenticated/AuthenticatedEmptyState.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { AuthenticatedPagination } from "../../../ui/authenticated/AuthenticatedPagination.js"
import { AuthenticatedRecordItem } from "../../../ui/authenticated/AuthenticatedRecordItem.js"
import { AuthenticatedRecordList } from "../../../ui/authenticated/AuthenticatedRecordList.js"
import { AuthenticatedRelativeTime } from "../../../ui/authenticated/AuthenticatedRelativeTime.js"
import { AuthenticatedSearchField } from "../../../ui/authenticated/AuthenticatedSearchField.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedSelect } from "../../../ui/authenticated/AuthenticatedSelect.js"
import { AuthenticatedSkeleton } from "../../../ui/authenticated/AuthenticatedSkeleton.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { AuthenticatedTabs } from "../../../ui/authenticated/AuthenticatedTabs.js"
import { AuthenticatedToolbar } from "../../../ui/authenticated/AuthenticatedToolbar.js"
import type { AuthenticatedDataTableSort } from "../../../ui/authenticated/authenticatedDataTableSort.js"
import { authenticatedTableClasses } from "../../../ui/authenticated/authenticatedTableClasses.js"
import { authenticatedIconRegistry } from "../../../ui/authenticated/authenticatedIconRegistry.js"
import { authenticatedUrlSearchParamWrite } from "../../../ui/authenticated/authenticatedUrlSearchParamWrite.js"
import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import type { ConfirmState } from "../../../ui/confirm/confirmStateCreate.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { machineUserStatusTone } from "../../machineUsers/ui/machineUserStatusTone.js"
import type { OrganizationRoleId } from "../../organizations/public/organizationRoleIdSchema.js"
import { organizationAdminInvitationStatusTone } from "../../organizations/ui/organizationAdminInvitationStatusTone.js"
import type { DirectoryEntry } from "../public/directoryEntrySchema.js"
import type { DirectoryAdminTab } from "./directoryAdminTabSchema.js"
import { directoryAdminUserStatusTone } from "./directoryAdminUserStatusTone.js"
import type { DirectoryAdminUsersDialogsState } from "./directoryAdminUsersDialogsStateCreate.js"
import type { DirectoryAdminUsersPageState } from "./directoryAdminUsersPageStateCreate.js"
import { directoryAdminUsersQueryParse } from "./directoryAdminUsersQuerySchema.js"
import { directoryOrganizationRolesGet } from "./directoryOrganizationRolesGet.js"
import { directoryRoleIconGet } from "./directoryRoleIconGet.js"
import { directoryRoleLabelKeyGet } from "./directoryRoleLabelKeyGet.js"
import { directoryTabIconGet } from "./directoryTabIconGet.js"

const directoryRoleMessageKey = (role: OrganizationRoleId): MessageKey => directoryRoleLabelKeyGet(role)

export type DirectoryAdminUsersViewState = {
  readonly basePath: string
  readonly confirmState: ConfirmState
  readonly dialogs: DirectoryAdminUsersDialogsState
  readonly navigateProfile: (userId: string) => void
  readonly page: DirectoryAdminUsersPageState
}

const roleFilters = ["owner", "admin", "member", "guest"] as const satisfies readonly OrganizationRoleId[]

const directoryUserNameGet = (entry: DirectoryEntry): string => entry.user.displayName ?? entry.user.userName

const directoryTabsHref = (basePath: string, search: string, tab: DirectoryAdminTab): string => {
  const params = new URLSearchParams(search)
  if (tab === "people") params.delete("tab")
  else params.set("tab", tab)
  const encoded = params.toString()
  return `${basePath}/users${encoded.length === 0 ? "" : `?${encoded}`}`
}

/** The users page: header with counts, tabs, people table, service accounts, and invitations. */
export function DirectoryAdminUsersView(props: { readonly state: DirectoryAdminUsersViewState }) {
  const state = props.state
  const page = () => state.page
  const location = useLocation()
  const navigate = useNavigate()
  const searchParamsSet = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(location.search)
    mutate(params)
    const encoded = params.toString()
    navigate(`${location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`, { replace: true })
  }
  const searchSet = (value: string) => authenticatedUrlSearchParamWrite("q", value)
  const dialogOpenSet = (dialog: "invite" | "create-user" | "create-service-account" | undefined) =>
    searchParamsSet((params) => {
      if (dialog === undefined) params.delete("dialog")
      else params.set("dialog", dialog)
    })
  const roleSet = (role: OrganizationRoleId | undefined) =>
    searchParamsSet((params) => {
      if (role === undefined) params.delete("role")
      else params.set("role", role)
    })
  const scopeSet = (scope: "organization" | "all") =>
    searchParamsSet((params) => {
      if (scope === "organization") params.delete("scope")
      else params.set("scope", scope)
    })
  const sortChange = (sort: AuthenticatedDataTableSort) =>
    searchParamsSet((params) => {
      params.set("sort", sort.key)
      params.set("dir", sort.direction)
    })

  const query = () => directoryAdminUsersQueryParse(location.search)
  const activeTab = (): DirectoryAdminTab => query().tab ?? "people"
  const activeRole = () => query().role
  const activeScope = () => (page().realmAdministrator() ? (query().scope ?? "organization") : "organization")
  const profileHref = (userId: string) => `${state.basePath}/users/${userId}`
  const tabItems = () => {
    const search = location.search
    return [
      {
        href: directoryTabsHref(state.basePath, search, "people"),
        icon: directoryTabIconGet("people"),
        label: messageTranslate("admin.users.directoryTabPeople"),
        value: "people" as const,
      },
      {
        count: undefined,
        href: directoryTabsHref(state.basePath, search, "service-accounts"),
        icon: directoryTabIconGet("service-accounts"),
        label: messageTranslate("admin.users.directoryTabServiceAccounts"),
        value: "service-accounts" as const,
      },
      {
        href: directoryTabsHref(state.basePath, search, "invitations"),
        icon: directoryTabIconGet("invitations"),
        label: messageTranslate("admin.users.directoryTabInvitations"),
        value: "invitations" as const,
      },
    ]
  }

  const roleCounts = () => page().summary()?.roles
  const subtitleCount = () => {
    if (activeTab() === "people") {
      // The header total must describe the filtered list: with an organization-scoped role
      // filter the matching pill count is the exact total, not the unfiltered people total.
      const role = activeRole()
      if (role !== undefined && activeScope() === "organization" && page().summary() !== undefined)
        return roleCounts()?.[role] ?? 0
      return page().summary() === undefined ? page().people().length : (page().summary()?.total ?? 0)
    }
    return activeTab() === "service-accounts" ? page().serviceAccounts().length : page().invitations().length
  }
  const subtitle = () => {
    const count = subtitleCount()
    if (count === 1)
      return messageTranslate(
        activeTab() === "people"
          ? "admin.users.directorySubtitleOne"
          : activeTab() === "service-accounts"
            ? "admin.users.directorySubtitleServiceAccountsOne"
            : "admin.users.directorySubtitleInvitationsOne",
      )
    return messageTranslate(
      activeTab() === "people"
        ? "admin.users.directorySubtitle"
        : activeTab() === "service-accounts"
          ? "admin.users.directorySubtitleServiceAccounts"
          : "admin.users.directorySubtitleInvitations",
      { count },
    )
  }

  const sortActive = (): AuthenticatedDataTableSort => {
    const parsed = query()
    return {
      direction: parsed.dir ?? (parsed.sort === "userName" ? "asc" : "desc"),
      key: parsed.sort ?? "lastSignInAt",
    }
  }

  const personRoles = (entry: DirectoryEntry): readonly OrganizationRoleId[] =>
    directoryOrganizationRolesGet(entry, page().organizationId())

  const roleCells = (entry: DirectoryEntry) => {
    if (activeScope() === "all") {
      return (
        <span class="flex flex-wrap items-center gap-1">
          <For each={entry.memberships}>
            {(membership) => (
              <AuthenticatedChip
                label={`${membership.organizationName}: ${membership.roles.map((role) => messageTranslate(directoryRoleMessageKey(role))).join(", ")}`}
                tone="neutral"
              />
            )}
          </For>
        </span>
      )
    }
    return (
      <span class="flex flex-wrap items-center gap-1">
        <For each={personRoles(entry)}>
          {(role) => (
            <AuthenticatedChip
              icon={directoryRoleIconGet(role)}
              label={messageTranslate(directoryRoleMessageKey(role))}
              tone={role === "owner" || role === "admin" ? "accent" : "neutral"}
            />
          )}
        </For>
      </span>
    )
  }

  const statusCell = (entry: DirectoryEntry) => (
    <span class="flex flex-wrap items-center gap-1">
      <AuthenticatedStatus
        label={messageTranslate(`admin.users.lifecycle.${entry.user.state}`)}
        tone={directoryAdminUserStatusTone(entry.user.state)}
      />
      <Show when={!entry.user.emailVerified}>
        <AuthenticatedChip label={messageTranslate("admin.users.unverifiedEmail")} tone="warning" />
      </Show>
    </span>
  )

  const peopleColumns = () => [
    {
      cell: (entry: DirectoryEntry) => (
        <span class="flex min-w-0 items-center gap-2.5">
          <AuthenticatedAvatar name={directoryUserNameGet(entry)} size="sm" src={entry.user.pictureUrl} />
          <span class="grid min-w-0">
            <span class="truncate font-medium">{directoryUserNameGet(entry)}</span>
            <span class="truncate text-xs text-muted-foreground">{entry.user.email}</span>
            <span class="truncate font-mono text-[0.6875rem] text-muted-foreground">@{entry.user.userName}</span>
          </span>
        </span>
      ),
      header: messageTranslate("admin.users.directoryUser"),
      key: "user",
    },
    {
      cell: (entry: DirectoryEntry) => roleCells(entry),
      header: messageTranslate("admin.users.directoryRole"),
      key: "role",
    },
    {
      cell: (entry: DirectoryEntry) => statusCell(entry),
      header: messageTranslate("admin.users.directoryStatus"),
      key: "status",
    },
    {
      cell: (entry: DirectoryEntry) => (
        <AuthenticatedRelativeTime
          fallback={<span class="text-muted-foreground">{messageTranslate("admin.users.directoryNever")}</span>}
          value={entry.user.lastSignInAt}
        />
      ),
      header: messageTranslate("admin.users.directoryLastSignIn"),
      key: "lastSignInAt",
      sortKey: "lastSignInAt",
    },
    {
      cell: (entry: DirectoryEntry) => <AuthenticatedRelativeTime value={entry.user.createdAt} />,
      header: messageTranslate("admin.users.directoryCreated"),
      key: "createdAt",
      sortKey: "createdAt",
    },
  ]

  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <ConfirmDialog state={state.confirmState} titleKey="admin.common.confirmTitle" />
      <AuthenticatedPageHeader
        actions={
          <>
            <AuthenticatedButton
              icon={authenticatedIconRegistry.directoryInvite}
              onClick={() => dialogOpenSet("invite")}
              variant="filledBlue"
            >
              {messageTranslate("admin.users.directoryInvite")}
            </AuthenticatedButton>
            <Show when={page().realmAdministrator()}>
              <AuthenticatedButton
                icon={authenticatedIconRegistry.directoryCreateUser}
                onClick={() => dialogOpenSet("create-user")}
                variant="outline"
              >
                {messageTranslate("admin.users.create")}
              </AuthenticatedButton>
            </Show>
          </>
        }
        description={subtitle()}
        title={messageTranslate("admin.users.title")}
      />

      <Show when={page().notice()}>{(notice) => <AuthenticatedNotice message={notice()} />}</Show>

      <AuthenticatedTabs active={activeTab()} items={tabItems()} label={messageTranslate("admin.users.title")} />

      <Show when={activeTab() === "people"}>
        <AuthenticatedToolbar
          actions={
            <Show when={page().realmAdministrator()}>
              <span class="grid w-44">
                <AuthenticatedSelect
                  aria-label={messageTranslate("admin.users.directoryOrganizations")}
                  getOptions={() => ["organization", "all"]}
                  id="directory-scope"
                  valueSignal={{
                    get: activeScope,
                    set: (value: string) => scopeSet(value as "organization" | "all"),
                  }}
                  valueText={(value) =>
                    value === "all"
                      ? messageTranslate("admin.users.directoryScopeAll")
                      : messageTranslate("admin.users.directoryScopeOrganization")
                  }
                />
              </span>
            </Show>
          }
          label={messageTranslate("admin.users.directoryTabPeople")}
        >
          <AuthenticatedSearchField
            onInput={searchSet}
            placeholder={messageTranslate("admin.users.directorySearchPlaceholder")}
            value={query().q ?? ""}
          />
          <fieldset class="flex flex-wrap items-center gap-1.5">
            <legend class="sr-only">{messageTranslate("admin.users.directoryRole")}</legend>
            <AuthenticatedButton
              aria-pressed={activeRole() === undefined}
              icon={directoryRoleIconGet("all")}
              onClick={() => roleSet(undefined)}
              size="sm"
              variant={activeRole() === undefined ? "filledBlue" : "outline"}
            >
              {messageTranslate("admin.users.directoryRoleAll")}
              <Show when={page().summary() !== undefined}>{` (${page().summary()?.total ?? 0})`}</Show>
            </AuthenticatedButton>
            <For each={roleFilters}>
              {(role) => (
                <AuthenticatedButton
                  aria-pressed={activeRole() === role}
                  icon={directoryRoleIconGet(role)}
                  onClick={() => roleSet(activeRole() === role ? undefined : role)}
                  size="sm"
                  variant={activeRole() === role ? "filledBlue" : "outline"}
                >
                  {messageTranslate(directoryRoleMessageKey(role))}
                  <Show when={roleCounts() !== undefined}>{` (${roleCounts()?.[role] ?? 0})`}</Show>
                </AuthenticatedButton>
              )}
            </For>
          </fieldset>
        </AuthenticatedToolbar>

        <Show
          when={page().status() === "ready" || page().status() === "empty"}
          fallback={
            <Show
              when={page().status() === "loading"}
              fallback={
                <AuthenticatedSection>
                  <AuthenticatedEmptyState
                    actions={
                      <AuthenticatedButton
                        icon={authenticatedIconRegistry.directoryRetry}
                        onClick={page().reload}
                        variant="outline"
                      >
                        {messageTranslate("common.retry")}
                      </AuthenticatedButton>
                    }
                    description={page().error() ?? messageTranslate("common.error")}
                    title={messageTranslate("common.error")}
                  />
                </AuthenticatedSection>
              }
            >
              <AuthenticatedSection>
                <div class="grid gap-2 p-5">
                  <For each={[0, 1, 2, 3, 4]}>{(index) => <AuthenticatedSkeleton index={index} />}</For>
                </div>
              </AuthenticatedSection>
            </Show>
          }
        >
          <Show
            when={page().people().length > 0}
            fallback={
              <AuthenticatedSection>
                <AuthenticatedEmptyState
                  actions={
                    <Show when={(query().q ?? "").length > 0 || activeRole() !== undefined}>
                      <AuthenticatedButton
                        icon={authenticatedIconRegistry.directoryClearFilters}
                        onClick={() => {
                          authenticatedUrlSearchParamWrite("q", "")
                          roleSet(undefined)
                        }}
                        variant="outline"
                      >
                        {messageTranslate("admin.users.directoryClearFilters")}
                      </AuthenticatedButton>
                    </Show>
                  }
                  description={
                    (query().q ?? "").length > 0 || activeRole() !== undefined
                      ? messageTranslate("admin.users.directoryEmptySearchDetail")
                      : messageTranslate("admin.users.directoryNoPeopleDetail")
                  }
                  icon={directoryTabIconGet("people")}
                  title={
                    (query().q ?? "").length > 0 || activeRole() !== undefined
                      ? messageTranslate("admin.users.directoryEmptySearch")
                      : messageTranslate("admin.users.directoryNoPeople")
                  }
                />
              </AuthenticatedSection>
            }
          >
            <AuthenticatedSection>
              <div class="hidden md:block">
                <AuthenticatedDataTable
                  activeSort={sortActive()}
                  caption={messageTranslate("admin.users.directoryTabPeople")}
                  columns={peopleColumns()}
                  onRowClick={(entry) => state.navigateProfile(entry.user.id)}
                  onSortChange={sortChange}
                  rowHref={(entry) => profileHref(entry.user.id)}
                  rowKey={(entry) => entry.user.id}
                  rows={page().people()}
                />
              </div>
              <AuthenticatedRecordList label={messageTranslate("admin.users.directoryTabPeople")}>
                <For each={page().people()}>
                  {(entry) => (
                    <AuthenticatedRecordItem
                      fields={[
                        { label: messageTranslate("admin.users.email"), value: entry.user.email, wide: true },
                        {
                          label: messageTranslate("admin.users.directoryUserName"),
                          value: `@${entry.user.userName}`,
                        },
                        {
                          label: messageTranslate("admin.users.directoryRole"),
                          value: roleCells(entry),
                        },
                        {
                          label: messageTranslate("admin.users.directoryLastSignIn"),
                          value: (
                            <AuthenticatedRelativeTime
                              fallback={
                                <span class="text-muted-foreground">
                                  {messageTranslate("admin.users.directoryNever")}
                                </span>
                              }
                              value={entry.user.lastSignInAt}
                            />
                          ),
                        },
                      ]}
                      status={statusCell(entry)}
                      title={
                        <span class="flex items-center gap-2">
                          <AuthenticatedAvatar
                            name={directoryUserNameGet(entry)}
                            size="sm"
                            src={entry.user.pictureUrl}
                          />
                          <span class="truncate">{directoryUserNameGet(entry)}</span>
                          <A
                            aria-label={messageTranslate("admin.users.directoryOpenProfile", {
                              name: directoryUserNameGet(entry),
                            })}
                            class="shrink-0 text-xs font-medium text-accent hover:underline"
                            href={profileHref(entry.user.id)}
                          >
                            {messageTranslate("admin.users.directoryOpen")}
                          </A>
                        </span>
                      }
                    />
                  )}
                </For>
              </AuthenticatedRecordList>
              <AuthenticatedPagination
                nextAvailable={page().nextPageAvailable()}
                onNext={page().pageNext}
                onPrevious={page().pagePrevious}
                previousAvailable={page().previousPageAvailable()}
              />
            </AuthenticatedSection>
          </Show>
        </Show>
      </Show>

      <Show when={activeTab() === "service-accounts"}>
        <ServiceAccountsSection dialogOpenSet={dialogOpenSet} state={state} />
      </Show>

      <Show when={activeTab() === "invitations"}>
        <InvitationsSection state={state} />
      </Show>

      <InviteUserDialog state={state} />
      <CreateUserDialog state={state} />
      <ServiceAccountDialog state={state} />
    </div>
  )
}

function ServiceAccountsSection(props: {
  readonly dialogOpenSet: (dialog: "create-service-account") => void
  readonly state: DirectoryAdminUsersViewState
}) {
  const page = () => props.state.page
  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <AuthenticatedToolbar
        actions={
          <AuthenticatedButton
            icon={authenticatedIconRegistry.directoryCreateServiceAccount}
            onClick={() => props.dialogOpenSet("create-service-account")}
            variant="filledBlue"
          >
            {messageTranslate("admin.users.directoryServiceAccountCreate")}
          </AuthenticatedButton>
        }
        label={messageTranslate("admin.users.directoryTabServiceAccounts")}
        summary={messageTranslate("admin.users.directorySubtitle", { count: page().serviceAccounts().length })}
      />
      <Show
        when={page().status() === "ready" || page().status() === "empty"}
        fallback={
          <AuthenticatedSection>
            <div class="grid gap-2 p-5">
              <For each={[0, 1, 2]}>{(index) => <AuthenticatedSkeleton index={index} />}</For>
            </div>
          </AuthenticatedSection>
        }
      >
        <Show
          when={page().serviceAccounts().length > 0}
          fallback={
            <AuthenticatedSection>
              <AuthenticatedEmptyState
                description={messageTranslate("admin.users.directoryServiceAccountEmptyDetail")}
                icon={directoryTabIconGet("service-accounts")}
                title={messageTranslate("admin.users.directoryServiceAccountEmpty")}
              />
            </AuthenticatedSection>
          }
        >
          <AuthenticatedSection>
            <Table
              aria-label={messageTranslate("admin.users.directoryTabServiceAccounts")}
              class={authenticatedTableClasses.tableWide}
              tabIndex={0}
            >
              <TableHeader class={authenticatedTableClasses.header}>
                <TableRow>
                  <TableHead class={authenticatedTableClasses.head}>
                    {messageTranslate("admin.users.directoryServiceAccountName")}
                  </TableHead>
                  <TableHead class={authenticatedTableClasses.head}>
                    {messageTranslate("admin.users.directoryServiceAccountUserName")}
                  </TableHead>
                  <TableHead class={authenticatedTableClasses.head}>
                    {messageTranslate("admin.users.directoryServiceAccountStatus")}
                  </TableHead>
                  <TableHead class={authenticatedTableClasses.head}>
                    {messageTranslate("admin.users.directoryCreated")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <For each={page().serviceAccounts()}>
                  {(account) => (
                    <TableRow class={authenticatedTableClasses.row}>
                      <TableCell class={authenticatedTableClasses.cell}>
                        <A
                          class="font-medium text-accent hover:underline"
                          href={`${props.state.basePath}/machine-users/${account.id}`}
                        >
                          {account.displayName}
                        </A>
                      </TableCell>
                      <TableCell class={authenticatedTableClasses.identifier}>{account.userName}</TableCell>
                      <TableCell class={authenticatedTableClasses.cell}>
                        <AuthenticatedStatus
                          label={messageTranslate(`admin.machine.statusValue.${account.status}`)}
                          tone={machineUserStatusTone(account.status)}
                        />
                      </TableCell>
                      <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap tabular-nums`}>
                        {localeDateFormat(account.createdAt, { dateStyle: "medium" })}
                      </TableCell>
                    </TableRow>
                  )}
                </For>
              </TableBody>
            </Table>
            <AuthenticatedRecordList label={messageTranslate("admin.users.directoryTabServiceAccounts")}>
              <For each={page().serviceAccounts()}>
                {(account) => (
                  <AuthenticatedRecordItem
                    fields={[
                      {
                        identifier: true,
                        label: messageTranslate("admin.users.directoryServiceAccountUserName"),
                        value: account.userName,
                      },
                      {
                        label: messageTranslate("admin.users.directoryCreated"),
                        value: localeDateFormat(account.createdAt, { dateStyle: "medium" }),
                      },
                    ]}
                    status={
                      <AuthenticatedStatus
                        label={messageTranslate(`admin.machine.statusValue.${account.status}`)}
                        tone={machineUserStatusTone(account.status)}
                      />
                    }
                    title={
                      <A
                        class="truncate text-accent hover:underline"
                        href={`${props.state.basePath}/machine-users/${account.id}`}
                      >
                        {account.displayName}
                      </A>
                    }
                  />
                )}
              </For>
            </AuthenticatedRecordList>
            <AuthenticatedPagination
              nextAvailable={page().serviceNextPageAvailable()}
              onNext={page().servicePageNext}
              onPrevious={page().servicePagePrevious}
              previousAvailable={page().servicePreviousPageAvailable()}
            />
          </AuthenticatedSection>
        </Show>
      </Show>
    </div>
  )
}

function InvitationsSection(props: { state: DirectoryAdminUsersViewState }) {
  const page = () => props.state.page
  return (
    <Show
      when={page().status() === "ready" || page().status() === "empty"}
      fallback={
        <AuthenticatedSection>
          <div class="grid gap-2 p-5">
            <For each={[0, 1]}>{(index) => <AuthenticatedSkeleton index={index} />}</For>
          </div>
        </AuthenticatedSection>
      }
    >
      <Show
        when={page().invitations().length > 0}
        fallback={
          <AuthenticatedSection>
            <AuthenticatedEmptyState
              description={messageTranslate("admin.organizations.invitations.empty")}
              icon={directoryTabIconGet("invitations")}
              title={messageTranslate("admin.organizations.invitations.title")}
            />
          </AuthenticatedSection>
        }
      >
        <AuthenticatedSection title={messageTranslate("admin.organizations.invitations.title")}>
          <AuthenticatedRecordList label={messageTranslate("admin.organizations.invitations.title")}>
            <For each={page().invitations()}>
              {(invitation) => (
                <AuthenticatedRecordItem
                  actions={
                    <Show when={invitation.status === "pending"}>
                      <AuthenticatedButton
                        disabled={page().pendingId() === `invitation:${invitation.id}`}
                        icon={authenticatedIconRegistry.directoryInviteRevoke}
                        onClick={() => page().invitationRevoke(invitation.id, invitation.email)}
                        size="sm"
                        variant="outline"
                      >
                        {messageTranslate("admin.organizations.invitations.revoke")}
                      </AuthenticatedButton>
                    </Show>
                  }
                  fields={[
                    {
                      label: messageTranslate("admin.organizations.memberships.roles"),
                      value: (
                        <span class="flex flex-wrap items-center gap-1">
                          <For each={invitation.roles}>
                            {(role) => (
                              <AuthenticatedChip
                                icon={directoryRoleIconGet(role)}
                                label={messageTranslate(directoryRoleMessageKey(role))}
                                tone="neutral"
                              />
                            )}
                          </For>
                        </span>
                      ),
                    },
                    {
                      label: messageTranslate("admin.organizations.invitations.expires"),
                      value: localeDateFormat(invitation.expiresAt, { dateStyle: "medium" }),
                    },
                  ]}
                  status={
                    <AuthenticatedStatus
                      label={messageTranslate(`admin.organizations.invitations.statusValue.${invitation.status}`)}
                      tone={organizationAdminInvitationStatusTone(invitation.status)}
                    />
                  }
                  title={invitation.email}
                />
              )}
            </For>
          </AuthenticatedRecordList>
          <Table
            aria-label={messageTranslate("admin.organizations.invitations.title")}
            class={authenticatedTableClasses.tableWide}
            tabIndex={0}
          >
            <TableHeader class={authenticatedTableClasses.header}>
              <TableRow>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.organizations.invitations.email")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.organizations.memberships.roles")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.organizations.status")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.users.directoryUserInvited")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.organizations.invitations.expires")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  <span class="sr-only">{messageTranslate("admin.organizations.invitations.revoke")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={page().invitations()}>
                {(invitation) => (
                  <TableRow class={authenticatedTableClasses.row}>
                    <TableCell class={`${authenticatedTableClasses.cell} font-medium`}>{invitation.email}</TableCell>
                    <TableCell class={authenticatedTableClasses.cell}>
                      <span class="flex flex-wrap items-center gap-1">
                        <For each={invitation.roles}>
                          {(role) => (
                            <AuthenticatedChip
                              icon={directoryRoleIconGet(role)}
                              label={messageTranslate(directoryRoleMessageKey(role))}
                              tone="neutral"
                            />
                          )}
                        </For>
                      </span>
                    </TableCell>
                    <TableCell class={authenticatedTableClasses.cell}>
                      <AuthenticatedStatus
                        label={messageTranslate(`admin.organizations.invitations.statusValue.${invitation.status}`)}
                        tone={organizationAdminInvitationStatusTone(invitation.status)}
                      />
                    </TableCell>
                    <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap tabular-nums`}>
                      {localeDateFormat(invitation.createdAt, { dateStyle: "medium" })}
                    </TableCell>
                    <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap tabular-nums`}>
                      {localeDateFormat(invitation.expiresAt, { dateStyle: "medium" })}
                    </TableCell>
                    <TableCell class={authenticatedTableClasses.action}>
                      <Show when={invitation.status === "pending"}>
                        <AuthenticatedButton
                          disabled={page().pendingId() === `invitation:${invitation.id}`}
                          icon={authenticatedIconRegistry.directoryInviteRevoke}
                          onClick={() => page().invitationRevoke(invitation.id, invitation.email)}
                          size="sm"
                          variant="outline"
                        >
                          {messageTranslate("admin.organizations.invitations.revoke")}
                        </AuthenticatedButton>
                      </Show>
                    </TableCell>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>
        </AuthenticatedSection>
      </Show>
    </Show>
  )
}

function InviteUserDialog(props: { state: DirectoryAdminUsersViewState }) {
  const location = useLocation()
  const navigate = useNavigate()
  const open = () => directoryAdminUsersQueryParse(location.search).dialog === "invite"
  const close = () => {
    const params = new URLSearchParams(location.search)
    params.delete("dialog")
    const encoded = params.toString()
    navigate(`${location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`, { replace: true })
  }
  const page = () => props.state.page
  const dialogs = () => props.state.dialogs
  const canInviteOwner = () => page().realmAdministrator()
  return (
    <AuthenticatedDialog
      description={messageTranslate("admin.users.directoryInviteDescription")}
      onOpenChange={(next) => {
        if (!next) close()
      }}
      open={open()}
      title={messageTranslate("admin.users.directoryInvite")}
    >
      <Show when={page().invitationToken() === undefined} fallback={<InvitationTokenPanel state={props.state} />}>
        <form class="grid gap-4" onSubmit={dialogs().inviteSubmit}>
          <div class="grid gap-1.5">
            <Label class="text-[0.8125rem] font-medium" for="directory-invite-email">
              {messageTranslate("admin.users.directoryInviteEmail")}
            </Label>
            <AuthenticatedInput
              id="directory-invite-email"
              onInput={(event) => dialogs().inviteEmail.set(event.currentTarget.value)}
              type="email"
              value={dialogs().inviteEmail.get()}
            />
          </div>
          <fieldset class="grid min-w-0 gap-1.5">
            <legend class="text-[0.8125rem] font-medium">{messageTranslate("admin.users.directoryInviteRole")}</legend>
            <div class="flex flex-wrap gap-3">
              <For each={roleFilters}>
                {(role) => (
                  <label class="flex items-center gap-2 text-sm" for={`directory-invite-role-${role}`}>
                    <input
                      checked={dialogs().inviteRoles.get().includes(role)}
                      class="size-4 accent-[var(--accent)] disabled:opacity-50"
                      disabled={role === "owner" && !canInviteOwner()}
                      id={`directory-invite-role-${role}`}
                      onChange={() => dialogs().inviteRolesToggle(role)}
                      type="checkbox"
                    />
                    <Icon aria-hidden="true" class="size-4 text-muted-foreground" path={directoryRoleIconGet(role)} />
                    {messageTranslate(directoryRoleMessageKey(role))}
                  </label>
                )}
              </For>
            </div>
          </fieldset>
          <Show when={dialogs().validationMessage()}>
            {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
          </Show>
          <div class="flex justify-end gap-2">
            <AuthenticatedButton icon={authenticatedIconRegistry.directoryInvite} type="submit" variant="filledBlue">
              {messageTranslate("admin.users.directoryInviteSubmit")}
            </AuthenticatedButton>
          </div>
        </form>
      </Show>
    </AuthenticatedDialog>
  )
}

function InvitationTokenPanel(props: { state: DirectoryAdminUsersViewState }) {
  const page = () => props.state.page
  const dialogs = () => props.state.dialogs
  return (
    <div class="grid min-w-0 gap-4" data-one-time-secret="organization-invitation">
      <div class="grid min-w-0 gap-1">
        <p class="text-xs font-medium text-muted-foreground">{messageTranslate("admin.users.inviteTokenTitle")}</p>
        <code
          class="block max-w-full break-all rounded-control border border-line bg-muted px-2 py-1.5 font-mono text-xs leading-5"
          data-secret-value
        >
          {page().invitationToken()}
        </code>
      </div>
      <p class="text-xs text-muted-foreground">{messageTranslate("admin.users.inviteTokenOnce")}</p>
      <div class="flex flex-wrap items-center gap-2">
        <AuthenticatedButton
          icon={authenticatedIconRegistry.directoryInviteCopy}
          onClick={() => dialogs().copyText(page().invitationToken())}
          size="sm"
          variant="outline"
        >
          {messageTranslate("admin.users.inviteTokenCopy")}
        </AuthenticatedButton>
        <AuthenticatedButton
          icon={authenticatedIconRegistry.directoryInviteAcknowledge}
          onClick={() => page().invitationTokenAcknowledge()}
          size="sm"
          variant="filledBlue"
        >
          {messageTranslate("admin.users.inviteTokenDismiss")}
        </AuthenticatedButton>
        <Show when={dialogs().copied()}>
          <span class="text-xs font-medium text-success" role="status">
            {messageTranslate("admin.users.inviteTokenCopied")}
          </span>
        </Show>
        <Show when={dialogs().copyFailed()}>
          <span class="text-xs font-medium text-danger" role="alert">
            {messageTranslate("admin.machine.secret.copyFailed")}
          </span>
        </Show>
      </div>
    </div>
  )
}

function CreateUserDialog(props: { state: DirectoryAdminUsersViewState }) {
  const location = useLocation()
  const navigate = useNavigate()
  const open = () => directoryAdminUsersQueryParse(location.search).dialog === "create-user"
  const close = () => {
    const params = new URLSearchParams(location.search)
    params.delete("dialog")
    const encoded = params.toString()
    navigate(`${location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`, { replace: true })
  }
  const page = () => props.state.page
  const dialogs = () => props.state.dialogs
  return (
    <AuthenticatedDialog
      description={messageTranslate("admin.users.createDescription")}
      onOpenChange={(next) => {
        if (!next) close()
      }}
      open={open()}
      title={messageTranslate("admin.users.create")}
    >
      <form class="grid gap-4" onSubmit={dialogs().createSubmit}>
        <div class="grid gap-1.5">
          <Label class="text-[0.8125rem] font-medium" for="directory-create-user-name">
            {messageTranslate("admin.users.userName")}
          </Label>
          <AuthenticatedInput
            id="directory-create-user-name"
            onInput={(event) => dialogs().createUserName.set(event.currentTarget.value)}
            value={dialogs().createUserName.get()}
          />
        </div>
        <div class="grid gap-1.5">
          <Label class="text-[0.8125rem] font-medium" for="directory-create-email">
            {messageTranslate("admin.users.email")}
          </Label>
          <AuthenticatedInput
            id="directory-create-email"
            onInput={(event) => dialogs().createEmail.set(event.currentTarget.value)}
            type="email"
            value={dialogs().createEmail.get()}
          />
        </div>
        <div class="grid gap-1.5">
          <Label class="text-[0.8125rem] font-medium" for="directory-create-first-name">
            {messageTranslate("admin.users.firstName")}
          </Label>
          <AuthenticatedInput
            id="directory-create-first-name"
            onInput={(event) => dialogs().createFirstName.set(event.currentTarget.value)}
            value={dialogs().createFirstName.get()}
          />
        </div>
        <div class="grid gap-1.5">
          <Label class="text-[0.8125rem] font-medium" for="directory-create-last-name">
            {messageTranslate("admin.users.lastName")}
          </Label>
          <AuthenticatedInput
            id="directory-create-last-name"
            onInput={(event) => dialogs().createLastName.set(event.currentTarget.value)}
            value={dialogs().createLastName.get()}
          />
        </div>
        <Show when={dialogs().validationMessage()}>
          {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
        </Show>
        <Show when={page().createdUser()}>
          {(user) => (
            <p class="text-sm text-success" role="status">
              <A class="font-medium text-accent hover:underline" href={`${props.state.basePath}/users/${user().id}`}>
                {messageTranslate("admin.users.created", { userName: user().userName })}
              </A>
            </p>
          )}
        </Show>
        <div class="flex justify-end gap-2">
          <AuthenticatedButton icon={authenticatedIconRegistry.directoryCreateUser} type="submit" variant="filledBlue">
            {messageTranslate("admin.users.createSubmit")}
          </AuthenticatedButton>
        </div>
      </form>
    </AuthenticatedDialog>
  )
}

function ServiceAccountDialog(props: { state: DirectoryAdminUsersViewState }) {
  const location = useLocation()
  const navigate = useNavigate()
  const open = () => directoryAdminUsersQueryParse(location.search).dialog === "create-service-account"
  const close = () => {
    const params = new URLSearchParams(location.search)
    params.delete("dialog")
    const encoded = params.toString()
    navigate(`${location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`, { replace: true })
    props.state.page.serviceSecretAcknowledge()
  }
  const page = () => props.state.page
  const dialogs = () => props.state.dialogs
  return (
    <AuthenticatedDialog
      description={messageTranslate("admin.users.directoryServiceAccountDescription")}
      onOpenChange={(next) => {
        if (!next) close()
      }}
      open={open()}
      title={messageTranslate("admin.users.directoryServiceAccountCreate")}
    >
      <Show when={page().serviceSecret() === undefined} fallback={<ServiceAccountSecretPanel state={props.state} />}>
        <form class="grid gap-4" onSubmit={dialogs().serviceSubmit}>
          <div class="grid gap-1.5">
            <Label class="text-[0.8125rem] font-medium" for="directory-service-name">
              {messageTranslate("admin.users.directoryServiceAccountName")}
            </Label>
            <AuthenticatedInput
              id="directory-service-name"
              onInput={(event) => dialogs().serviceName.set(event.currentTarget.value)}
              value={dialogs().serviceName.get()}
            />
          </div>
          <div class="grid gap-1.5">
            <Label class="text-[0.8125rem] font-medium" for="directory-service-user-name">
              {messageTranslate("admin.users.directoryServiceAccountUserName")}
            </Label>
            <AuthenticatedInput
              class="font-mono text-xs"
              id="directory-service-user-name"
              onInput={(event) => dialogs().serviceUserName.set(event.currentTarget.value)}
              value={dialogs().serviceUserName.get()}
            />
            <p class="text-xs leading-4 text-muted-foreground">
              {messageTranslate("admin.users.directoryServiceAccountUserNameHint")}
            </p>
          </div>
          <div class="grid gap-1.5">
            <Label class="text-[0.8125rem] font-medium" for="directory-service-scopes">
              {messageTranslate("admin.users.directoryServiceAccountScopes")}
            </Label>
            <AuthenticatedInput
              class="font-mono text-xs"
              id="directory-service-scopes"
              onInput={(event) => dialogs().serviceScopes.set(event.currentTarget.value)}
              value={dialogs().serviceScopes.get()}
            />
            <p class="text-xs leading-4 text-muted-foreground">
              {messageTranslate("admin.users.directoryServiceAccountScopesHint")}
            </p>
          </div>
          <Show when={dialogs().validationMessage()}>
            {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
          </Show>
          <p class="rounded-control border border-warning/35 bg-warning-soft px-3.5 py-3 text-xs leading-5 text-warning">
            {messageTranslate("admin.users.directoryServiceAccountSecretWarning")}
          </p>
          <div class="flex justify-end gap-2">
            <AuthenticatedButton
              icon={authenticatedIconRegistry.directoryCreateServiceAccount}
              type="submit"
              variant="filledBlue"
            >
              {messageTranslate("common.save")}
            </AuthenticatedButton>
          </div>
        </form>
      </Show>
    </AuthenticatedDialog>
  )
}

function ServiceAccountSecretPanel(props: { state: DirectoryAdminUsersViewState }) {
  const page = () => props.state.page
  const dialogs = () => props.state.dialogs
  return (
    <div class="grid min-w-0 gap-4" data-one-time-secret="machine-credential">
      <div class="grid min-w-0 gap-1">
        <p class="text-xs font-medium text-muted-foreground">{messageTranslate("admin.machine.secret.clientId")}</p>
        <code
          class="block max-w-full break-all rounded-control border border-line bg-surface px-2 py-1.5 font-mono text-xs leading-5"
          data-client-id
        >
          {page().serviceSecret()?.clientId}
        </code>
      </div>
      <div class="grid min-w-0 gap-1">
        <p class="text-xs font-medium text-muted-foreground">
          {messageTranslate("admin.users.directoryServiceAccountSecretTitle")}
        </p>
        <code
          class="block max-w-full break-all rounded-control border border-line bg-surface px-2 py-1.5 font-mono text-xs leading-5"
          data-secret-value
        >
          {page().serviceSecret()?.secret}
        </code>
      </div>
      <p class="text-xs text-warning">{messageTranslate("admin.users.directoryServiceAccountSecretWarning")}</p>
      <div class="flex flex-wrap items-center gap-2">
        <AuthenticatedButton
          icon={authenticatedIconRegistry.directoryInviteCopy}
          onClick={() => dialogs().copyText(page().serviceSecret()?.secret)}
          size="sm"
          variant="outline"
        >
          {messageTranslate("admin.users.directoryServiceAccountSecretCopy")}
        </AuthenticatedButton>
        <AuthenticatedButton
          icon={authenticatedIconRegistry.directoryInviteAcknowledge}
          onClick={() => page().serviceSecretAcknowledge()}
          size="sm"
          variant="filledBlue"
        >
          {messageTranslate("admin.users.inviteTokenDismiss")}
        </AuthenticatedButton>
        <Show when={dialogs().copied()}>
          <span class="text-xs font-medium text-success" role="status">
            {messageTranslate("admin.users.directoryServiceAccountSecretCopied")}
          </span>
        </Show>
      </div>
    </div>
  )
}
