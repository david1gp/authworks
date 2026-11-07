import { A, useLocation, useNavigate } from "@solidjs/router"
import { For, Show } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
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
import { authenticatedIconRegistry } from "../../../ui/authenticated/authenticatedIconRegistry.js"
import { authenticatedTableClasses } from "../../../ui/authenticated/authenticatedTableClasses.js"
import { authenticatedUrlSearchParamWrite } from "../../../ui/authenticated/authenticatedUrlSearchParamWrite.js"
import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import type { ConfirmState } from "../../../ui/confirm/confirmStateCreate.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { machineUserStatusTone } from "../../machineUsers/ui/machineUserStatusTone.js"
import type { OrganizationRoleId } from "../../organizations/public/organizationRoleIdSchema.js"
import type { Team } from "../../teams/public/teamSchema.js"
import { organizationAdminInvitationStatusTone } from "../../organizations/ui/organizationAdminInvitationStatusTone.js"
import type { DirectoryEntry } from "../public/directoryEntrySchema.js"
import type { DirectoryAdminTab } from "./directoryAdminTabSchema.js"
import { directoryAdminUserStatusTone } from "./directoryAdminUserStatusTone.js"
import type { DirectoryAdminUsersDialogsState } from "./directoryAdminUsersDialogsStateCreate.js"
import type { DirectoryAdminUsersPageState } from "./directoryAdminUsersPageStateCreate.js"
import type { DirectoryTeamsDialogsState } from "./directoryTeamsDialogsStateCreate.js"
import type { DirectoryTeamsPageState } from "./directoryTeamsPageStateCreate.js"
import { directoryAdminUsersQueryParse } from "./directoryAdminUsersQuerySchema.js"
import { directoryOrganizationRolesGet } from "./directoryOrganizationRolesGet.js"
import { directoryRoleDescriptionKeyGet } from "./directoryRoleDescriptionKeyGet.js"
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
  readonly teams: DirectoryTeamsPageState
  readonly teamsDialogs: DirectoryTeamsDialogsState
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
  const dialogOpenSet = (
    dialog: "invite" | "create-user" | "create-service-account" | "create-team" | "edit-team" | undefined,
  ) =>
    searchParamsSet((params) => {
      if (dialog === undefined) params.delete("dialog")
      else params.set("dialog", dialog)
    })
  const roleSet = (role: OrganizationRoleId | undefined) =>
    searchParamsSet((params) => {
      if (role === undefined) params.delete("role")
      else params.set("role", role)
    })
  const teamFilterSet = (team: string | undefined) =>
    searchParamsSet((params) => {
      if (team === undefined) params.delete("team")
      else params.set("team", team)
    })
  const activeTeamFilter = () => query().team
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
  const activeTab = (): DirectoryAdminTab => page().tab()
  const activeRole = () => query().role
  const activeScope = () => (page().realmAdministrator() ? (query().scope ?? "organization") : "organization")
  const profileHref = (userId: string) => `${state.basePath}/users/${userId}`
  const tabItems = () => {
    const search = location.search
    const teams = () => state.teams
    if (!teams().canManageAll()) {
      return [
        {
          href: directoryTabsHref(state.basePath, search, "teams"),
          icon: directoryTabIconGet("teams"),
          label: messageTranslate("admin.users.directoryTabTeams"),
          value: "teams" as const,
        },
      ]
    }
    return [
      {
        href: directoryTabsHref(state.basePath, search, "people"),
        icon: directoryTabIconGet("people"),
        label: messageTranslate("admin.users.directoryTabPeople"),
        value: "people" as const,
      },
      {
        href: directoryTabsHref(state.basePath, search, "teams"),
        icon: directoryTabIconGet("teams"),
        label: messageTranslate("admin.users.directoryTabTeams"),
        value: "teams" as const,
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
      const team = activeTeamFilter()
      if (team !== undefined)
        return team === "unassigned"
          ? state.teams.unassignedCount()
          : (state.teams.teamBySlug(team)?.memberCount ?? page().people().length)
      const role = activeRole()
      if (role !== undefined && activeScope() === "organization" && page().summary() !== undefined)
        return roleCounts()?.[role] ?? 0
      return page().summary() === undefined ? page().people().length : (page().summary()?.total ?? 0)
    }
    if (activeTab() === "teams") return state.teams.teams().length
    return activeTab() === "service-accounts" ? page().serviceAccounts().length : page().invitations().length
  }
  const subtitle = () => {
    const count = subtitleCount()
    if (count === 1)
      return messageTranslate(
        activeTab() === "people"
          ? "admin.users.directorySubtitleOne"
          : activeTab() === "teams"
            ? "admin.users.directorySubtitleTeamsOne"
            : activeTab() === "service-accounts"
              ? "admin.users.directorySubtitleServiceAccountsOne"
              : "admin.users.directorySubtitleInvitationsOne",
      )
    return messageTranslate(
      activeTab() === "people"
        ? "admin.users.directorySubtitle"
        : activeTab() === "teams"
          ? "admin.users.directorySubtitleTeams"
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
    </span>
  )

  const peopleColumns = () => [
    {
      cell: (entry: DirectoryEntry) => (
        <span class="flex min-w-0 items-center gap-2.5">
          <AuthenticatedAvatar
            class="size-6"
            name={directoryUserNameGet(entry)}
            size="sm"
            src={entry.user.pictureUrl}
          />
          <span class="truncate font-medium" title={directoryUserNameGet(entry)}>
            {directoryUserNameGet(entry)}
          </span>
        </span>
      ),
      header: messageTranslate("admin.users.displayName"),
      key: "user",
    },
    {
      cell: (entry: DirectoryEntry) => (
        <span class="font-mono text-xs" title={entry.user.userName}>
          @{entry.user.userName}
        </span>
      ),
      header: messageTranslate("admin.userProfile.username"),
      key: "userName",
      sortKey: "userName",
    },
    {
      cell: (entry: DirectoryEntry) => (
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="truncate text-muted-foreground" title={entry.user.email}>
            {entry.user.email}
          </span>
          <Show when={!entry.user.emailVerified}>
            <span
              aria-label={messageTranslate("admin.users.unverifiedEmail")}
              class="size-2 rounded-full bg-warning"
              role="img"
              title={messageTranslate("admin.users.unverifiedEmail")}
            />
          </Show>
        </span>
      ),
      header: messageTranslate("admin.users.email"),
      key: "email",
    },
    {
      cell: (entry: DirectoryEntry) => roleCells(entry),
      header: messageTranslate("admin.users.directoryRole"),
      key: "role",
    },
    {
      cell: (entry: DirectoryEntry) => (
        <span class="truncate text-muted-foreground" title={entry.team?.name ?? undefined}>
          {entry.team?.name ?? messageTranslate("admin.users.directoryTeamUnassigned")}
        </span>
      ),
      header: messageTranslate("admin.users.directoryTeamColumn"),
      key: "team",
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
      align: "end" as const,
      class: "whitespace-nowrap tabular-nums",
      sortKey: "lastSignInAt",
    },
    {
      cell: (entry: DirectoryEntry) => <AuthenticatedRelativeTime value={entry.user.createdAt} />,
      header: messageTranslate("admin.users.directoryCreated"),
      key: "createdAt",
      align: "end" as const,
      class: "whitespace-nowrap tabular-nums",
      sortKey: "createdAt",
    },
  ]

  return (
    <div class="grid min-w-0 gap-3 [&>*]:min-w-0 [&>header>div:first-child>div:first-child]:flex [&>header>div:first-child>div:first-child]:flex-wrap [&>header>div:first-child>div:first-child]:items-baseline [&>header>div:first-child>div:first-child]:gap-x-3">
      <ConfirmDialog state={state.confirmState} titleKey="admin.common.confirmTitle" />
      <AuthenticatedPageHeader
        actions={
          <>
            <Show when={state.teams.canManageAll() || state.teams.isLeaderScope()}>
              <AuthenticatedButton
                icon={authenticatedIconRegistry.directoryInvite}
                onClick={() => dialogOpenSet("invite")}
                variant="filledBlue"
              >
                {messageTranslate("admin.users.directoryInvite")}
              </AuthenticatedButton>
            </Show>
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

      <AuthenticatedTabs
        active={activeTab()}
        class="flex-wrap sm:flex-nowrap"
        items={tabItems()}
        label={messageTranslate("admin.users.title")}
      />

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
          <AuthenticatedSearchField onInput={searchSet} value={query().q ?? ""} />
          <span class="grid w-52">
            <AuthenticatedSelect
              aria-label={messageTranslate("admin.users.directoryTeamFilter")}
              getOptions={() => ["", ...state.teams.teams().map((team) => team.slug), "unassigned"]}
              id="directory-team-filter"
              valueSignal={{
                get: () => activeTeamFilter() ?? "",
                set: (value: string) => teamFilterSet(value === "" ? undefined : value),
              }}
              valueText={(value) =>
                value === ""
                  ? messageTranslate("admin.users.directoryTeamAll")
                  : value === "unassigned"
                    ? messageTranslate("admin.users.directoryTeamUnassigned")
                    : (state.teams.teamBySlug(value)?.name ?? value)
              }
            />
          </span>
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
                    <Show
                      when={
                        (query().q ?? "").length > 0 || activeRole() !== undefined || activeTeamFilter() !== undefined
                      }
                    >
                      <AuthenticatedButton
                        icon={authenticatedIconRegistry.directoryClearFilters}
                        onClick={() => {
                          authenticatedUrlSearchParamWrite("q", "")
                          roleSet(undefined)
                          teamFilterSet(undefined)
                        }}
                        variant="outline"
                      >
                        {messageTranslate("admin.users.directoryClearFilters")}
                      </AuthenticatedButton>
                    </Show>
                  }
                  description={
                    (query().q ?? "").length > 0 || activeRole() !== undefined || activeTeamFilter() !== undefined
                      ? activeTeamFilter() !== undefined
                        ? messageTranslate("admin.users.directoryEmptySearchTeamDetail")
                        : messageTranslate("admin.users.directoryEmptySearchDetail")
                      : messageTranslate("admin.users.directoryNoPeopleDetail")
                  }
                  icon={directoryTabIconGet("people")}
                  title={
                    (query().q ?? "").length > 0 || activeRole() !== undefined || activeTeamFilter() !== undefined
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
                      compact
                      meta={[
                        `@${entry.user.userName}`,
                        personRoles(entry)
                          .map((role) => messageTranslate(directoryRoleMessageKey(role)))
                          .join(", ") || "—",
                        entry.team?.name ?? messageTranslate("admin.users.directoryTeamUnassigned"),
                        <AuthenticatedRelativeTime
                          fallback={messageTranslate("admin.users.directoryNever")}
                          value={entry.user.lastSignInAt}
                        />,
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

      <Show when={activeTab() === "teams"}>
        <TeamsSection dialogOpenSet={dialogOpenSet} state={state} />
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
      <CreateTeamDialog state={state} />
      <EditTeamDialog state={state} />
    </div>
  )
}

function DirectoryTabStatePanel(props: {
  readonly onRetry: () => void
  readonly state: () => {
    readonly error: () => string | undefined
    readonly status: () => string
  }
}) {
  const page = () => props.state()
  return (
    <AuthenticatedSection>
      <AuthenticatedEmptyState
        actions={
          <Show when={page().status() === "error"}>
            <AuthenticatedButton
              icon={authenticatedIconRegistry.directoryRetry}
              onClick={props.onRetry}
              variant="outline"
            >
              {messageTranslate("common.retry")}
            </AuthenticatedButton>
          </Show>
        }
        description={
          page().status() === "permission-denied"
            ? messageTranslate("admin.common.permission")
            : page().status() === "assurance-required"
              ? messageTranslate("admin.organizations.assuranceRequired")
              : (page().error() ?? messageTranslate("common.error"))
        }
        title={
          page().status() === "assurance-required"
            ? messageTranslate("admin.organizations.assuranceRequiredTitle")
            : messageTranslate("common.error")
        }
      />
    </AuthenticatedSection>
  )
}

function ServiceAccountsSection(props: {
  readonly dialogOpenSet: (dialog: "create-team" | "create-service-account") => void
  readonly state: DirectoryAdminUsersViewState
}) {
  const page = () => props.state.page
  return (
    <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
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
          <Show
            when={page().status() === "loading"}
            fallback={<DirectoryTabStatePanel onRetry={page().reload} state={page} />}
          >
            <AuthenticatedSection>
              <div class="grid gap-2 p-5">
                <For each={[0, 1, 2]}>{(index) => <AuthenticatedSkeleton index={index} />}</For>
              </div>
            </AuthenticatedSection>
          </Show>
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
                        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <A
                            class="font-medium text-accent hover:underline"
                            href={`${props.state.basePath}/machine-users/${account.id}`}
                          >
                            {account.displayName}
                          </A>
                          <A
                            class="text-xs font-medium text-accent hover:underline"
                            href={`${props.state.basePath}/machine-credentials?machineUserId=${encodeURIComponent(account.id)}`}
                          >
                            {messageTranslate("shell.nav.credentialsTokens")}
                          </A>
                        </div>
                      </TableCell>
                      <TableCell class={authenticatedTableClasses.identifier}>{account.userName}</TableCell>
                      <TableCell class={authenticatedTableClasses.cell}>
                        <AuthenticatedStatus
                          label={messageTranslate(`admin.machine.statusValue.${account.status}`)}
                          tone={machineUserStatusTone(account.status)}
                        />
                      </TableCell>
                      <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap tabular-nums`}>
                        <AuthenticatedRelativeTime value={account.createdAt} />
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
                        value: <AuthenticatedRelativeTime value={account.createdAt} />,
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
                    actions={
                      <A
                        class="text-xs font-medium text-accent hover:underline"
                        href={`${props.state.basePath}/machine-credentials?machineUserId=${encodeURIComponent(account.id)}`}
                      >
                        {messageTranslate("shell.nav.credentialsTokens")}
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
        <Show
          when={page().status() === "loading"}
          fallback={<DirectoryTabStatePanel onRetry={page().reload} state={page} />}
        >
          <AuthenticatedSection>
            <div class="grid gap-2 p-5">
              <For each={[0, 1]}>{(index) => <AuthenticatedSkeleton index={index} />}</For>
            </div>
          </AuthenticatedSection>
        </Show>
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
                      label: messageTranslate("admin.organizations.invitations.team"),
                      value: invitation.team?.name ?? messageTranslate("admin.organizations.invitations.teamNone"),
                    },
                    {
                      label: messageTranslate("admin.organizations.invitations.invitedBy"),
                      value:
                        invitation.invitedBy?.displayName ??
                        invitation.invitedBy?.email ??
                        messageTranslate("admin.userProfile.invitedByUnknown"),
                    },
                    {
                      label: messageTranslate("admin.organizations.invitations.expires"),
                      value: <AuthenticatedRelativeTime value={invitation.expiresAt} />,
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
                  {messageTranslate("admin.organizations.invitations.team")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.organizations.invitations.invitedBy")}
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
                      {invitation.team?.name ?? messageTranslate("admin.organizations.invitations.teamNone")}
                    </TableCell>
                    <TableCell class={authenticatedTableClasses.cell}>
                      {invitation.invitedBy?.displayName ??
                        invitation.invitedBy?.email ??
                        messageTranslate("admin.userProfile.invitedByUnknown")}
                    </TableCell>
                    <TableCell class={authenticatedTableClasses.cell}>
                      <AuthenticatedStatus
                        label={messageTranslate(`admin.organizations.invitations.statusValue.${invitation.status}`)}
                        tone={organizationAdminInvitationStatusTone(invitation.status)}
                      />
                    </TableCell>
                    <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap tabular-nums`}>
                      <AuthenticatedRelativeTime value={invitation.createdAt} />
                    </TableCell>
                    <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap tabular-nums`}>
                      <AuthenticatedRelativeTime value={invitation.expiresAt} />
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
            <p class="text-xs text-muted-foreground" id="directory-invite-role-hint">
              {messageTranslate("admin.users.directoryInviteRoleHint")}
            </p>
            <div aria-describedby="directory-invite-role-hint" class="grid gap-2">
              <For each={roleFilters}>
                {(role) => {
                  const selected = () => dialogs().inviteRoles.get().includes(role)
                  const disabled = () => role === "owner" && !canInviteOwner()
                  return (
                    <label
                      class={`flex items-start gap-2.5 rounded-control border px-3 py-2 ${selected() ? "border-accent bg-accent-soft/60" : "border-line bg-surface"} ${disabled() ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-line-strong"}`}
                      for={`directory-invite-role-${role}`}
                    >
                      <input
                        aria-describedby={`directory-invite-role-${role}-description`}
                        checked={selected()}
                        class="mt-0.5 size-4 shrink-0 accent-[var(--accent)] disabled:opacity-50"
                        disabled={disabled()}
                        id={`directory-invite-role-${role}`}
                        onChange={() => dialogs().inviteRolesToggle(role)}
                        type="checkbox"
                      />
                      <Icon
                        aria-hidden="true"
                        class="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        path={directoryRoleIconGet(role)}
                      />
                      <span class="grid min-w-0 gap-0.5">
                        <span class="text-sm font-medium">{messageTranslate(directoryRoleMessageKey(role))}</span>
                        <span class="text-xs text-muted-foreground" id={`directory-invite-role-${role}-description`}>
                          {messageTranslate(directoryRoleDescriptionKeyGet(role))}
                        </span>
                      </span>
                    </label>
                  )
                }}
              </For>
            </div>
          </fieldset>
          <Show when={props.state.teams.canManageAll()}>
            <div class="grid gap-1.5">
              <Label class="text-[0.8125rem] font-medium" for="directory-invite-team">
                {messageTranslate("admin.organizations.invitations.team")}
              </Label>
              <AuthenticatedSelect
                aria-label={messageTranslate("admin.organizations.invitations.team")}
                getOptions={() => ["", ...props.state.teams.teams().map((team) => team.id)]}
                id="directory-invite-team"
                valueSignal={dialogs().inviteTeam}
                valueText={(value) =>
                  value === ""
                    ? messageTranslate("admin.organizations.invitations.teamNone")
                    : (props.state.teams.teams().find((team) => team.id === value)?.name ?? value)
                }
              />
              <p class="text-xs leading-4 text-muted-foreground">
                {messageTranslate("admin.organizations.invitations.teamHint")}
              </p>
            </div>
          </Show>
          <Show when={props.state.teams.isLeaderScope() ? props.state.teams.ledTeams()[0] : undefined}>
            {(leaderTeam) => (
              <p class="text-xs leading-4 text-muted-foreground">
                {messageTranslate("admin.organizations.invitations.teamFixed", { name: leaderTeam().name })}
              </p>
            )}
          </Show>
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
          {page().invitationLink()}
        </code>
      </div>
      <p class="text-xs text-muted-foreground">{messageTranslate("admin.users.inviteTokenOnce")}</p>
      <div class="flex flex-wrap items-center gap-2">
        <AuthenticatedButton
          icon={authenticatedIconRegistry.directoryInviteCopy}
          onClick={() => dialogs().copyText(page().invitationLink())}
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

const teamsHref = (basePath: string, search: string, slug: string | undefined): string => {
  const params = new URLSearchParams(search)
  params.set("tab", "teams")
  if (slug === undefined) params.delete("team")
  else params.set("team", slug)
  const encoded = params.toString()
  return `${basePath}/users${encoded.length === 0 ? "" : `?${encoded}`}`
}

function TeamsSection(props: {
  readonly dialogOpenSet: (dialog: "create-team" | "edit-team" | "invite") => void
  readonly state: DirectoryAdminUsersViewState
}) {
  const teams = () => props.state.teams
  const location = useLocation()
  const navigate = useNavigate()
  const teamSelect = (slug: string | undefined) => {
    const params = new URLSearchParams(location.search)
    params.set("tab", "teams")
    if (slug === undefined) params.delete("team")
    else params.set("team", slug)
    const encoded = params.toString()
    navigate(`${location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`, { replace: false })
  }
  const slug = () => teams().selectedSlug()
  return (
    <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <Show when={teams().notice()}>{(message) => <AuthenticatedNotice message={message()} />}</Show>
      <Show when={teams().isLeaderScope() ? teams().ledTeams()[0] : undefined}>
        {(leaderTeam) => (
          <AuthenticatedNotice message={messageTranslate("admin.teams.scopeNotice", { name: leaderTeam().name })} />
        )}
      </Show>
      <Show
        when={teams().status() === "ready"}
        fallback={
          <Show
            when={teams().status() === "loading"}
            fallback={<DirectoryTabStatePanel onRetry={teams().teamsReload} state={teams} />}
          >
            <AuthenticatedSection>
              <div class="grid gap-2 p-5">
                <For each={[0, 1, 2]}>{(index) => <AuthenticatedSkeleton index={index} />}</For>
              </div>
            </AuthenticatedSection>
          </Show>
        }
      >
        <Show
          when={slug() === undefined}
          fallback={<TeamDetail dialogOpenSet={props.dialogOpenSet} onSelect={teamSelect} state={props.state} />}
        >
          <AuthenticatedToolbar
            actions={
              <Show when={teams().canManageAll()}>
                <AuthenticatedButton
                  icon={authenticatedIconRegistry.directoryTeamCreate}
                  onClick={() => {
                    props.state.teamsDialogs.createOpen()
                    props.dialogOpenSet("create-team")
                  }}
                  variant="filledBlue"
                >
                  {messageTranslate("admin.teams.create")}
                </AuthenticatedButton>
              </Show>
            }
            label={messageTranslate("admin.teams.title")}
            summary={messageTranslate("admin.teams.description")}
          />
          <Show
            when={teams().teams().length > 0}
            fallback={
              <AuthenticatedSection>
                <AuthenticatedEmptyState
                  description={messageTranslate("admin.teams.listEmptyDetail")}
                  icon={directoryTabIconGet("teams")}
                  title={messageTranslate("admin.teams.listEmpty")}
                />
              </AuthenticatedSection>
            }
          >
            <TeamsList onSelect={teamSelect} state={props.state} />
          </Show>
        </Show>
      </Show>
    </div>
  )
}

function TeamsList(props: {
  readonly onSelect: (slug: string | undefined) => void
  readonly state: DirectoryAdminUsersViewState
}) {
  const teams = () => props.state.teams
  const memberCountText = (count: number) =>
    count === 1
      ? messageTranslate("admin.teams.memberCountOne")
      : messageTranslate("admin.teams.memberCount", { count })
  return (
    <AuthenticatedSection>
      <div class="hidden md:block">
        <Table
          aria-label={messageTranslate("admin.teams.title")}
          class={authenticatedTableClasses.tableWide}
          tabIndex={0}
        >
          <TableHeader class={authenticatedTableClasses.header}>
            <TableRow>
              <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.teams.name")}</TableHead>
              <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.teams.slug")}</TableHead>
              <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.teams.leader")}</TableHead>
              <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.teams.members")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <For each={teams().teams()}>
              {(team) => (
                <TableRow class={authenticatedTableClasses.row}>
                  <TableCell class={authenticatedTableClasses.cell}>
                    <A
                      aria-label={messageTranslate("admin.teams.openTeam", { name: team.name })}
                      class="font-medium text-accent hover:underline"
                      href={teamsHref(props.state.basePath, window.location.search, team.slug)}
                    >
                      {team.name}
                    </A>
                  </TableCell>
                  <TableCell class={authenticatedTableClasses.cell}>
                    <span class="font-mono text-xs">{team.slug}</span>
                  </TableCell>
                  <TableCell class={authenticatedTableClasses.cell}>
                    <TeamLeaderCell team={team} />
                  </TableCell>
                  <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap tabular-nums`}>
                    {memberCountText(team.memberCount)}
                  </TableCell>
                </TableRow>
              )}
            </For>
            <TableRow class={authenticatedTableClasses.row}>
              <TableCell class={authenticatedTableClasses.cell}>
                <A
                  aria-label={messageTranslate("admin.teams.openTeam", {
                    name: messageTranslate("admin.teams.unassignedTitle"),
                  })}
                  class="font-medium text-accent hover:underline"
                  href={teamsHref(props.state.basePath, window.location.search, "unassigned")}
                >
                  {messageTranslate("admin.teams.unassignedTitle")}
                </A>
              </TableCell>
              <TableCell class={authenticatedTableClasses.cell}>
                <span class="font-mono text-xs">{messageTranslate("admin.teams.unassignedSlug")}</span>
              </TableCell>
              <TableCell class={authenticatedTableClasses.cell}>
                <span class="text-muted-foreground">—</span>
              </TableCell>
              <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap tabular-nums`}>
                {memberCountText(teams().unassignedCount())}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <AuthenticatedRecordList label={messageTranslate("admin.teams.title")}>
        <For each={teams().teams()}>
          {(team) => (
            <AuthenticatedRecordItem
              fields={[
                {
                  label: messageTranslate("admin.teams.slug"),
                  value: <span class="font-mono text-xs">{team.slug}</span>,
                },
                { label: messageTranslate("admin.teams.leader"), value: <TeamLeaderCell team={team} /> },
              ]}
              meta={[memberCountText(team.memberCount)]}
              title={
                <A
                  aria-label={messageTranslate("admin.teams.openTeam", { name: team.name })}
                  class="truncate text-accent hover:underline"
                  href={teamsHref(props.state.basePath, window.location.search, team.slug)}
                >
                  {team.name}
                </A>
              }
            />
          )}
        </For>
        <AuthenticatedRecordItem
          fields={[
            {
              label: messageTranslate("admin.teams.slug"),
              value: <span class="font-mono text-xs">{messageTranslate("admin.teams.unassignedSlug")}</span>,
            },
          ]}
          meta={[memberCountText(teams().unassignedCount())]}
          title={
            <A
              class="truncate text-accent hover:underline"
              href={teamsHref(props.state.basePath, window.location.search, "unassigned")}
            >
              {messageTranslate("admin.teams.unassignedTitle")}
            </A>
          }
        />
      </AuthenticatedRecordList>
    </AuthenticatedSection>
  )
}

function TeamLeaderCell(props: { readonly team: Team }) {
  const name = () => props.team.leader.displayName ?? props.team.leader.email ?? props.team.leader.userId
  return (
    <span class="flex min-w-0 items-center gap-1.5">
      <AuthenticatedAvatar class="size-6" name={name()} size="sm" />
      <span class="truncate" title={props.team.leader.email ?? undefined}>
        {name()}
      </span>
    </span>
  )
}

function TeamDetail(props: {
  readonly dialogOpenSet: (dialog: "create-team" | "edit-team" | "invite") => void
  readonly onSelect: (slug: string | undefined) => void
  readonly state: DirectoryAdminUsersViewState
}) {
  const teams = () => props.state.teams
  const slug = () => teams().selectedSlug()
  return (
    <Show
      when={slug() === "unassigned"}
      fallback={<TeamDetailBody dialogOpenSet={props.dialogOpenSet} onSelect={props.onSelect} state={props.state} />}
    >
      <UnassignedDetail state={props.state} />
    </Show>
  )
}

function TeamDetailBody(props: {
  readonly dialogOpenSet: (dialog: "create-team" | "edit-team" | "invite") => void
  readonly onSelect: (slug: string | undefined) => void
  readonly state: DirectoryAdminUsersViewState
}) {
  const teams = () => props.state.teams
  const team = () => teams().selectedTeam()
  const location = useLocation()
  const backHref = () => {
    const params = new URLSearchParams(location.search)
    params.set("tab", "teams")
    params.delete("team")
    const encoded = params.toString()
    return `${location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`
  }
  return (
    <Show
      when={team()}
      fallback={
        <AuthenticatedSection>
          <AuthenticatedEmptyState
            actions={
              <A class="text-sm font-medium text-accent hover:underline" href={backHref()}>
                {messageTranslate("admin.teams.backToTeams")}
              </A>
            }
            description={messageTranslate("common.error")}
            icon={directoryTabIconGet("teams")}
            title={messageTranslate("common.error")}
          />
        </AuthenticatedSection>
      }
    >
      {(current) => (
        <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
          <AuthenticatedSection
            actions={
              <>
                <Show when={teams().canManageAll() || teams().isLeaderScope()}>
                  <AuthenticatedButton
                    icon={authenticatedIconRegistry.directoryTeamEdit}
                    onClick={() => {
                      props.state.teamsDialogs.editOpen(current())
                      props.dialogOpenSet("edit-team")
                    }}
                    size="sm"
                    variant="outline"
                  >
                    {messageTranslate("admin.teams.editTitle")}
                  </AuthenticatedButton>
                </Show>
                <Show when={teams().canManageAll()}>
                  <AuthenticatedButton
                    disabled={teams().pendingId() !== undefined}
                    icon={authenticatedIconRegistry.directoryTeamDelete}
                    onClick={() =>
                      void teams()
                        .teamDeleteSubmit(current())
                        .then((deleted) => {
                          if (deleted) props.onSelect(undefined)
                        })
                    }
                    size="sm"
                    variant="outlineRed"
                  >
                    {messageTranslate("admin.teams.delete")}
                  </AuthenticatedButton>
                </Show>
              </>
            }
            padded
            title={current().name}
          >
            <div class="grid gap-2">
              <p>
                <A class="text-sm font-medium text-accent hover:underline" href={backHref()}>
                  {`← ${messageTranslate("admin.teams.backToTeams")}`}
                </A>
              </p>
              <div class="flex flex-wrap items-center gap-1.5">
                <AuthenticatedChip label={current().slug} tone="neutral" />
                <AuthenticatedChip
                  icon={authenticatedIconRegistry.directoryTabPeople}
                  label={messageTranslate(
                    current().memberCount === 1 ? "admin.teams.memberCountOne" : "admin.teams.memberCount",
                    { count: current().memberCount },
                  )}
                  tone="neutral"
                />
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm text-muted-foreground">{messageTranslate("admin.teams.leader")}</span>
                <TeamLeaderCell team={current()} />
                <AuthenticatedChip label={messageTranslate("admin.teams.leaderBadge")} tone="accent" />
              </div>
              <Show when={teams().validationMessage()}>
                {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
              </Show>
            </div>
          </AuthenticatedSection>
          <Show
            when={teams().membersError() === undefined}
            fallback={
              <AuthenticatedSection>
                <AuthenticatedEmptyState
                  actions={
                    <AuthenticatedButton
                      icon={authenticatedIconRegistry.directoryRetry}
                      onClick={teams().membersReload}
                      variant="outline"
                    >
                      {messageTranslate("common.retry")}
                    </AuthenticatedButton>
                  }
                  description={teams().membersError() ?? messageTranslate("common.error")}
                  title={messageTranslate("common.error")}
                />
              </AuthenticatedSection>
            }
          >
            <TeamMembersList state={props.state} team={current()} />
          </Show>
          <Show when={teams().canManageAll() || teams().isLeaderScope()}>
            <TeamAddMember state={props.state} team={current()} />
          </Show>
        </div>
      )}
    </Show>
  )
}

function TeamMembersList(props: { readonly state: DirectoryAdminUsersViewState; readonly team: Team }) {
  const teams = () => props.state.teams
  const team = () => props.team
  const memberName = (entry: { user: { displayName?: string; userName: string } }) =>
    entry.user.displayName ?? entry.user.userName
  return (
    <AuthenticatedSection
      description={messageTranslate("admin.teams.memberCount", { count: team().memberCount })}
      title={messageTranslate("admin.teams.members")}
    >
      <Show
        when={teams().members().length > 0}
        fallback={
          <AuthenticatedEmptyState
            description={messageTranslate("admin.teams.membersEmptyDetail")}
            icon={directoryTabIconGet("teams")}
            title={messageTranslate("admin.teams.membersEmpty")}
          />
        }
      >
        <div class="hidden md:block">
          <Table
            aria-label={messageTranslate("admin.teams.members")}
            class={authenticatedTableClasses.tableWide}
            tabIndex={0}
          >
            <TableHeader class={authenticatedTableClasses.header}>
              <TableRow>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.users.displayName")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.users.email")}</TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.users.directoryRole")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  <span class="sr-only">{messageTranslate("common.remove")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={teams().members()}>
                {(entry) => (
                  <TableRow class={authenticatedTableClasses.row}>
                    <TableCell class={authenticatedTableClasses.cell}>
                      <span class="flex min-w-0 items-center gap-2">
                        <AuthenticatedAvatar name={memberName(entry)} size="sm" src={entry.user.pictureUrl} />
                        <A
                          class="truncate font-medium text-accent hover:underline"
                          href={`${props.state.basePath}/users/${entry.user.id}`}
                        >
                          {memberName(entry)}
                        </A>
                        <Show when={team().leader.userId === entry.user.id}>
                          <AuthenticatedChip label={messageTranslate("admin.teams.leaderBadge")} tone="accent" />
                        </Show>
                      </span>
                    </TableCell>
                    <TableCell class={authenticatedTableClasses.cell}>
                      <span class="truncate text-muted-foreground">{entry.user.email}</span>
                    </TableCell>
                    <TableCell class={authenticatedTableClasses.cell}>
                      <span class="flex flex-wrap items-center gap-1">
                        <For each={entry.memberships[0]?.roles ?? []}>
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
                    <TableCell class={authenticatedTableClasses.action}>
                      <Show when={teams().canManageAll() || teams().isLeaderScope()}>
                        <AuthenticatedButton
                          disabled={teams().pendingId() !== undefined || team().leader.userId === entry.user.id}
                          icon={authenticatedIconRegistry.directoryTeamDelete}
                          onClick={() =>
                            void teams().teamMemberUnassignSubmit(team(), entry.user.id, memberName(entry))
                          }
                          size="sm"
                          title={
                            team().leader.userId === entry.user.id
                              ? messageTranslate("admin.teams.removeLeaderDenied")
                              : messageTranslate("common.remove")
                          }
                          variant="outline"
                        >
                          {messageTranslate("common.remove")}
                        </AuthenticatedButton>
                      </Show>
                    </TableCell>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>
        </div>
        <AuthenticatedRecordList label={messageTranslate("admin.teams.members")}>
          <For each={teams().members()}>
            {(entry) => (
              <AuthenticatedRecordItem
                actions={
                  <Show
                    when={(teams().canManageAll() || teams().isLeaderScope()) && team().leader.userId !== entry.user.id}
                  >
                    <AuthenticatedButton
                      disabled={teams().pendingId() !== undefined}
                      icon={authenticatedIconRegistry.directoryTeamDelete}
                      onClick={() => void teams().teamMemberUnassignSubmit(team(), entry.user.id, memberName(entry))}
                      size="sm"
                      variant="outline"
                    >
                      {messageTranslate("common.remove")}
                    </AuthenticatedButton>
                  </Show>
                }
                fields={[{ label: messageTranslate("admin.users.email"), value: entry.user.email }]}
                status={
                  <Show when={team().leader.userId === entry.user.id}>
                    <AuthenticatedChip label={messageTranslate("admin.teams.leaderBadge")} tone="accent" />
                  </Show>
                }
                title={
                  <A
                    class="truncate text-accent hover:underline"
                    href={`${props.state.basePath}/users/${entry.user.id}`}
                  >
                    {memberName(entry)}
                  </A>
                }
              />
            )}
          </For>
        </AuthenticatedRecordList>
        <AuthenticatedPagination
          nextAvailable={teams().memberNextPageAvailable()}
          onNext={teams().memberPageNext}
          onPrevious={teams().memberPagePrevious}
          previousAvailable={teams().memberPreviousPageAvailable()}
        />
      </Show>
    </AuthenticatedSection>
  )
}

function TeamAddMember(props: { readonly state: DirectoryAdminUsersViewState; readonly team: Team }) {
  const teams = () => props.state.teams
  const dialogs = () => props.state.teamsDialogs
  const memberName = (entry: { user: { displayName?: string; userName: string } }) =>
    entry.user.displayName ?? entry.user.userName
  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    void teams().memberCandidateSearch(dialogs().memberSearch.get())
  }
  return (
    <AuthenticatedSection padded title={messageTranslate("admin.teams.addMember")}>
      <form class="grid gap-3" onSubmit={submit}>
        <AuthenticatedSearchField
          onInput={(value) => dialogs().memberSearch.set(value)}
          value={dialogs().memberSearch.get()}
        />
        <Show when={teams().pickerResults().length > 0}>
          <ul class="grid gap-2">
            <For each={teams().pickerResults()}>
              {(entry) => {
                const leadsOther = () => {
                  const leadership = teams().teamLeadershipOfGet(entry.user.id)
                  return leadership !== undefined && leadership.id !== props.team.id ? leadership : undefined
                }
                const inThisTeam = () => entry.team?.id === props.team.id
                return (
                  <li class="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line-subtle px-3.5 py-2.5">
                    <div class="flex min-w-0 flex-wrap items-center gap-1.5">
                      <AuthenticatedAvatar name={memberName(entry)} size="sm" src={entry.user.pictureUrl} />
                      <span class="min-w-0">
                        <span class="block truncate text-sm font-medium">{memberName(entry)}</span>
                        <span class="block truncate text-xs text-muted-foreground">{entry.user.email}</span>
                      </span>
                      <Show when={entry.team !== null && !inThisTeam()}>
                        <AuthenticatedChip
                          label={messageTranslate("admin.teams.currentTeamHint", { team: entry.team?.name ?? "" })}
                          tone="neutral"
                        />
                      </Show>
                      <Show when={leadsOther()}>
                        {(leadership) => (
                          <AuthenticatedChip
                            label={messageTranslate("admin.teams.leadsTeamHint", { team: leadership().name })}
                            tone="accent"
                          />
                        )}
                      </Show>
                    </div>
                    <Show when={!inThisTeam()}>
                      <AuthenticatedButton
                        disabled={teams().pendingId() !== undefined || leadsOther() !== undefined}
                        icon={authenticatedIconRegistry.directoryTeamCreate}
                        onClick={() =>
                          void teams()
                            .teamMemberAssignSubmit(props.team, entry.user.id, memberName(entry))
                            .then((assigned) => {
                              if (assigned) void teams().memberCandidateSearch(dialogs().memberSearch.get())
                            })
                        }
                        size="sm"
                        title={
                          leadsOther() === undefined
                            ? messageTranslate("admin.teams.addMember")
                            : messageTranslate("admin.teams.leaderConflict")
                        }
                        variant="outline"
                      >
                        {messageTranslate("admin.teams.addMemberAction")}
                      </AuthenticatedButton>
                    </Show>
                  </li>
                )
              }}
            </For>
          </ul>
        </Show>
      </form>
    </AuthenticatedSection>
  )
}

function UnassignedDetail(props: { readonly state: DirectoryAdminUsersViewState }) {
  const teams = () => props.state.teams
  const location = useLocation()
  const backHref = () => {
    const params = new URLSearchParams(location.search)
    params.set("tab", "teams")
    params.delete("team")
    const encoded = params.toString()
    return `${location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`
  }
  const memberName = (entry: { user: { displayName?: string; userName: string } }) =>
    entry.user.displayName ?? entry.user.userName
  return (
    <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <AuthenticatedSection
        description={messageTranslate("admin.teams.unassignedDescription")}
        padded
        title={messageTranslate("admin.teams.unassignedTitle")}
      >
        <p>
          <A class="text-sm font-medium text-accent hover:underline" href={backHref()}>
            {messageTranslate("admin.teams.backToTeams")}
          </A>
        </p>
        <Show when={teams().validationMessage()}>
          {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
        </Show>
      </AuthenticatedSection>
      <Show
        when={teams().membersError() === undefined}
        fallback={
          <AuthenticatedSection>
            <AuthenticatedEmptyState
              actions={
                <AuthenticatedButton
                  icon={authenticatedIconRegistry.directoryRetry}
                  onClick={teams().membersReload}
                  variant="outline"
                >
                  {messageTranslate("common.retry")}
                </AuthenticatedButton>
              }
              description={teams().membersError() ?? messageTranslate("common.error")}
              title={messageTranslate("common.error")}
            />
          </AuthenticatedSection>
        }
      >
        <Show
          when={teams().members().length > 0}
          fallback={
            <AuthenticatedSection>
              <AuthenticatedEmptyState
                description={messageTranslate("admin.teams.membersEmptyDetail")}
                icon={directoryTabIconGet("teams")}
                title={messageTranslate("admin.teams.membersEmpty")}
              />
            </AuthenticatedSection>
          }
        >
          <AuthenticatedSection>
            <div class="hidden md:block">
              <Table
                aria-label={messageTranslate("admin.teams.unassignedTitle")}
                class={authenticatedTableClasses.tableWide}
                tabIndex={0}
              >
                <TableHeader class={authenticatedTableClasses.header}>
                  <TableRow>
                    <TableHead class={authenticatedTableClasses.head}>
                      {messageTranslate("admin.users.displayName")}
                    </TableHead>
                    <TableHead class={authenticatedTableClasses.head}>
                      {messageTranslate("admin.users.email")}
                    </TableHead>
                    <TableHead class={authenticatedTableClasses.head}>
                      {messageTranslate("admin.users.directoryRole")}
                    </TableHead>
                    <TableHead class={authenticatedTableClasses.head}>
                      <span class="sr-only">{messageTranslate("admin.teams.selectTeam")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <For each={teams().members()}>
                    {(entry) => (
                      <TableRow class={authenticatedTableClasses.row}>
                        <TableCell class={authenticatedTableClasses.cell}>
                          <span class="flex min-w-0 items-center gap-2">
                            <AuthenticatedAvatar name={memberName(entry)} size="sm" src={entry.user.pictureUrl} />
                            <A
                              class="truncate font-medium text-accent hover:underline"
                              href={`${props.state.basePath}/users/${entry.user.id}`}
                            >
                              {memberName(entry)}
                            </A>
                          </span>
                        </TableCell>
                        <TableCell class={authenticatedTableClasses.cell}>
                          <span class="truncate text-muted-foreground">{entry.user.email}</span>
                        </TableCell>
                        <TableCell class={authenticatedTableClasses.cell}>
                          <span class="flex flex-wrap items-center gap-1">
                            <For each={entry.memberships[0]?.roles ?? []}>
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
                        <TableCell class={authenticatedTableClasses.action}>
                          <Show when={teams().canManageAll()}>
                            <UnassignedAssignControl entryId={entry.user.id} idPrefix="desktop" state={props.state} />
                          </Show>
                        </TableCell>
                      </TableRow>
                    )}
                  </For>
                </TableBody>
              </Table>
            </div>
            <AuthenticatedRecordList label={messageTranslate("admin.teams.unassignedTitle")}>
              <For each={teams().members()}>
                {(entry) => (
                  <AuthenticatedRecordItem
                    actions={
                      <Show when={teams().canManageAll()}>
                        <UnassignedAssignControl entryId={entry.user.id} idPrefix="mobile" state={props.state} />
                      </Show>
                    }
                    fields={[{ label: messageTranslate("admin.users.email"), value: entry.user.email }]}
                    title={
                      <span class="flex items-center gap-2">
                        <AuthenticatedAvatar name={memberName(entry)} size="sm" src={entry.user.pictureUrl} />
                        <A
                          class="truncate text-accent hover:underline"
                          href={`${props.state.basePath}/users/${entry.user.id}`}
                        >
                          {memberName(entry)}
                        </A>
                      </span>
                    }
                  />
                )}
              </For>
            </AuthenticatedRecordList>
            <AuthenticatedPagination
              nextAvailable={teams().memberNextPageAvailable()}
              onNext={teams().memberPageNext}
              onPrevious={teams().memberPagePrevious}
              previousAvailable={teams().memberPreviousPageAvailable()}
            />
          </AuthenticatedSection>
        </Show>
      </Show>
    </div>
  )
}

function UnassignedAssignControl(props: {
  readonly entryId: string
  readonly idPrefix: string
  readonly state: DirectoryAdminUsersViewState
}) {
  const teams = () => props.state.teams
  const selection = createSignalObject("")
  const memberName = (entry: { user: { displayName?: string; userName: string } }) =>
    entry.user.displayName ?? entry.user.userName
  return (
    <span class="flex flex-wrap items-center gap-1.5">
      <span class="grid w-44">
        <AuthenticatedSelect
          aria-label={messageTranslate("admin.teams.selectTeam")}
          getOptions={() =>
            teams()
              .teams()
              .map((team) => team.slug)
          }
          id={`${props.idPrefix}-unassigned-assign-${props.entryId}`}
          valueSignal={selection}
          valueText={(slug) => teams().teamBySlug(slug)?.name ?? slug}
        />
      </span>
      <AuthenticatedButton
        disabled={selection.get().length === 0 || teams().pendingId() !== undefined}
        icon={authenticatedIconRegistry.directoryTeamCreate}
        onClick={() => {
          const team = teams().teamBySlug(selection.get())
          const entry = teams()
            .members()
            .find((person) => person.user.id === props.entryId)
          if (team === undefined || entry === undefined) return
          void teams()
            .teamMemberAssignSubmit(team, entry.user.id, memberName(entry))
            .then((assigned) => {
              if (assigned) selection.set("")
            })
        }}
        size="sm"
        variant="outline"
      >
        {messageTranslate("admin.teams.addMemberAction")}
      </AuthenticatedButton>
    </span>
  )
}

function CreateTeamDialog(props: { state: DirectoryAdminUsersViewState }) {
  const location = useLocation()
  const navigate = useNavigate()
  const open = () => directoryAdminUsersQueryParse(location.search).dialog === "create-team"
  const close = () => {
    const params = new URLSearchParams(location.search)
    params.delete("dialog")
    const encoded = params.toString()
    navigate(`${location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`, { replace: true })
  }
  const teams = () => props.state.teams
  const dialogs = () => props.state.teamsDialogs
  const previewUrl = () =>
    `${window.location.origin}${props.state.basePath}/users?tab=teams&team=${encodeURIComponent(dialogs().createSlug.get() || "slug")}`
  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    void dialogs()
      .createSubmit()
      .then((team) => {
        if (team === undefined) return
        close()
        const params = new URLSearchParams(location.search)
        params.set("tab", "teams")
        params.set("team", team.slug)
        params.delete("dialog")
        const encoded = params.toString()
        navigate(`${location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`, { replace: false })
      })
  }
  return (
    <AuthenticatedDialog
      description={messageTranslate("admin.teams.createDescription")}
      onOpenChange={(next) => {
        if (!next) close()
      }}
      open={open()}
      title={messageTranslate("admin.teams.create")}
    >
      <form class="grid gap-4" onSubmit={submit}>
        <div class="grid gap-1.5">
          <Label class="text-[0.8125rem] font-medium" for="directory-team-create-name">
            {messageTranslate("admin.teams.name")}
          </Label>
          <AuthenticatedInput
            id="directory-team-create-name"
            onInput={(event) => dialogs().createNameSet(event.currentTarget.value)}
            value={dialogs().createName.get()}
          />
        </div>
        <div class="grid gap-1.5">
          <Label class="text-[0.8125rem] font-medium" for="directory-team-create-slug">
            {messageTranslate("admin.teams.slug")}
          </Label>
          <AuthenticatedInput
            class="font-mono text-xs"
            id="directory-team-create-slug"
            onInput={(event) => dialogs().createSlugSet(event.currentTarget.value)}
            value={dialogs().createSlug.get()}
          />
          <p class="text-xs leading-4 text-muted-foreground">{messageTranslate("admin.teams.slugHint")}</p>
          <p class="break-all font-mono text-xs text-muted-foreground">
            {messageTranslate("admin.teams.urlPreview", { url: previewUrl() })}
          </p>
        </div>
        <TeamLeaderPicker
          id="directory-team-create-leader"
          onSelect={(userId) => dialogs().createLeaderUserId.set(userId)}
          state={props.state}
          value={dialogs().createLeaderUserId.get()}
        />
        <Show when={dialogs().validationMessage()}>
          {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
        </Show>
        <div class="flex justify-end gap-2">
          <AuthenticatedButton
            disabled={teams().pendingId() !== undefined}
            icon={authenticatedIconRegistry.directoryTeamCreate}
            type="submit"
            variant="filledBlue"
          >
            {messageTranslate("admin.teams.createSubmit")}
          </AuthenticatedButton>
        </div>
      </form>
    </AuthenticatedDialog>
  )
}

function EditTeamDialog(props: { state: DirectoryAdminUsersViewState }) {
  const location = useLocation()
  const navigate = useNavigate()
  const open = () => directoryAdminUsersQueryParse(location.search).dialog === "edit-team"
  const close = () => {
    const params = new URLSearchParams(location.search)
    params.delete("dialog")
    const encoded = params.toString()
    navigate(`${location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`, { replace: true })
  }
  const teams = () => props.state.teams
  const dialogs = () => props.state.teamsDialogs
  const team = () => teams().selectedTeam()
  const previewUrl = () =>
    `${window.location.origin}${props.state.basePath}/users?tab=teams&team=${encodeURIComponent(dialogs().editSlug.get() || "slug")}`
  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    const current = team()
    if (current === undefined) return
    void dialogs()
      .editSubmit(current)
      .then((updated) => {
        if (updated === undefined) return
        close()
        const params = new URLSearchParams(location.search)
        params.set("tab", "teams")
        params.set("team", updated.slug)
        params.delete("dialog")
        const encoded = params.toString()
        navigate(`${location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`, { replace: false })
      })
  }
  return (
    <AuthenticatedDialog
      description={messageTranslate("admin.teams.createDescription")}
      onOpenChange={(next) => {
        if (!next) close()
      }}
      open={open()}
      title={messageTranslate("admin.teams.editTitle")}
    >
      <Show when={team()} fallback={<AuthenticatedEmptyState title={messageTranslate("common.error")} />}>
        {(current) => (
          <form class="grid gap-4" onSubmit={submit}>
            <div class="grid gap-1.5">
              <Label class="text-[0.8125rem] font-medium" for="directory-team-edit-name">
                {messageTranslate("admin.teams.name")}
              </Label>
              <AuthenticatedInput
                id="directory-team-edit-name"
                onInput={(event) => dialogs().editNameSet(event.currentTarget.value)}
                value={dialogs().editName.get()}
              />
            </div>
            <div class="grid gap-1.5">
              <Label class="text-[0.8125rem] font-medium" for="directory-team-edit-slug">
                {messageTranslate("admin.teams.slug")}
              </Label>
              <AuthenticatedInput
                class="font-mono text-xs"
                id="directory-team-edit-slug"
                onInput={(event) => dialogs().editSlugSet(event.currentTarget.value)}
                value={dialogs().editSlug.get()}
              />
              <p class="text-xs leading-4 text-muted-foreground">{messageTranslate("admin.teams.slugHint")}</p>
              <p class="break-all font-mono text-xs text-muted-foreground">
                {messageTranslate("admin.teams.urlPreview", { url: previewUrl() })}
              </p>
            </div>
            <Show when={teams().canManageAll()}>
              <TeamLeaderPicker
                id="directory-team-edit-leader"
                onSelect={(userId) => dialogs().editLeaderUserId.set(userId)}
                state={props.state}
                value={dialogs().editLeaderUserId.get()}
              />
            </Show>
            <Show when={dialogs().validationMessage()}>
              {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
            </Show>
            <div class="flex justify-end gap-2">
              <AuthenticatedButton
                disabled={teams().pendingId() !== undefined}
                icon={authenticatedIconRegistry.directoryTeamEdit}
                type="submit"
                variant="filledBlue"
              >
                {messageTranslate("common.save")}
              </AuthenticatedButton>
            </div>
          </form>
        )}
      </Show>
    </AuthenticatedDialog>
  )
}

function TeamLeaderPicker(props: {
  readonly id: string
  readonly onSelect: (userId: string) => void
  readonly state: DirectoryAdminUsersViewState
  readonly value: string
}) {
  const teams = () => props.state.teams
  const dialogs = () => props.state.teamsDialogs
  const memberName = (entry: { user: { displayName?: string; userName: string } }) =>
    entry.user.displayName ?? entry.user.userName
  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    void teams().memberCandidateSearch(dialogs().memberSearch.get())
  }
  return (
    <div class="grid gap-1.5">
      <Label class="text-[0.8125rem] font-medium" for={props.id}>
        {messageTranslate("admin.teams.leader")}
      </Label>
      <p class="text-xs leading-4 text-muted-foreground">{messageTranslate("admin.teams.leaderHint")}</p>
      <form class="grid gap-2" onSubmit={submit}>
        <AuthenticatedSearchField
          onInput={(value) => dialogs().memberSearch.set(value)}
          value={dialogs().memberSearch.get()}
        />
      </form>
      <Show when={teams().pickerResults().length > 0}>
        <div
          class="grid max-h-56 gap-1 overflow-y-auto"
          role="radiogroup"
          aria-label={messageTranslate("admin.teams.leader")}
        >
          <For each={teams().pickerResults()}>
            {(entry) => {
              const leadsOther = () => teams().teamLeadershipOfGet(entry.user.id)
              return (
                <label
                  class={`flex cursor-pointer items-center gap-2 rounded-control border px-3 py-2 text-[13px] hover:border-line-strong ${props.value === entry.user.id ? "border-accent bg-accent-soft/60" : "border-line bg-surface"}`}
                >
                  <input
                    checked={props.value === entry.user.id}
                    disabled={leadsOther() !== undefined && props.value !== entry.user.id}
                    name={props.id}
                    onChange={() => props.onSelect(entry.user.id)}
                    type="radio"
                  />
                  <AuthenticatedAvatar name={memberName(entry)} size="sm" src={entry.user.pictureUrl} />
                  <span class="grid min-w-0">
                    <span class="truncate text-sm font-medium">{memberName(entry)}</span>
                    <span class="truncate text-xs text-muted-foreground">{entry.user.email}</span>
                  </span>
                  <Show when={leadsOther()}>
                    {(leadership) => (
                      <AuthenticatedChip
                        label={messageTranslate("admin.teams.leadsTeamHint", { team: leadership().name })}
                        tone="accent"
                      />
                    )}
                  </Show>
                </label>
              )
            }}
          </For>
        </div>
      </Show>
    </div>
  )
}
