import { mdiAccountArrowRight } from "@adaptive-ds/mdi/mdiAccountArrowRight.js"
import { mdiAccountCogOutline } from "@adaptive-ds/mdi/mdiAccountCogOutline.js"
import { mdiAccountEyeOutline } from "@adaptive-ds/mdi/mdiAccountEyeOutline.js"
import { mdiAccountOutline } from "@adaptive-ds/mdi/mdiAccountOutline.js"
import { mdiArrowLeft } from "@adaptive-ds/mdi/mdiArrowLeft.js"
import { mdiBriefcase } from "@adaptive-ds/mdi/mdiBriefcase.js"
import { mdiCellphone } from "@adaptive-ds/mdi/mdiCellphone.js"
import { mdiCheck } from "@adaptive-ds/mdi/mdiCheck.js"
import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiDeleteOutline } from "@adaptive-ds/mdi/mdiDeleteOutline.js"
import { mdiEmailOutline } from "@adaptive-ds/mdi/mdiEmailOutline.js"
import { mdiFingerprint } from "@adaptive-ds/mdi/mdiFingerprint.js"
import { mdiKeyChange } from "@adaptive-ds/mdi/mdiKeyChange.js"
import { mdiKeyVariant } from "@adaptive-ds/mdi/mdiKeyVariant.js"
import { mdiLogout } from "@adaptive-ds/mdi/mdiLogout.js"
import { mdiMonitorCellphone } from "@adaptive-ds/mdi/mdiMonitorCellphone.js"
import { mdiPencil } from "@adaptive-ds/mdi/mdiPencil.js"
import { mdiPlus } from "@adaptive-ds/mdi/mdiPlus.js"
import { mdiShieldCrownOutline } from "@adaptive-ds/mdi/mdiShieldCrownOutline.js"
import { mdiShieldOutline } from "@adaptive-ds/mdi/mdiShieldOutline.js"
import { mdiTwoFactorAuthentication } from "@adaptive-ds/mdi/mdiTwoFactorAuthentication.js"
import { A } from "@solidjs/router"
import { createEffect, For, Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { AuthenticatedActionMenu } from "../../../ui/authenticated/AuthenticatedActionMenu.js"
import { AuthenticatedAvatar } from "../../../ui/authenticated/AuthenticatedAvatar.js"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedChip } from "../../../ui/authenticated/AuthenticatedChip.js"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedEmptyState } from "../../../ui/authenticated/AuthenticatedEmptyState.js"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedOptionCard } from "../../../ui/authenticated/AuthenticatedOptionCard.js"
import { AuthenticatedPageBody } from "../../../ui/authenticated/AuthenticatedPageBody.js"
import { AuthenticatedProfileHeader } from "../../../ui/authenticated/AuthenticatedProfileHeader.js"
import { AuthenticatedRecordItem } from "../../../ui/authenticated/AuthenticatedRecordItem.js"
import { AuthenticatedRecordList } from "../../../ui/authenticated/AuthenticatedRecordList.js"
import { AuthenticatedRelativeTime } from "../../../ui/authenticated/AuthenticatedRelativeTime.js"
import { AuthenticatedSearchField } from "../../../ui/authenticated/AuthenticatedSearchField.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedSelect } from "../../../ui/authenticated/AuthenticatedSelect.js"
import { AuthenticatedSkeleton } from "../../../ui/authenticated/AuthenticatedSkeleton.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { AuthenticatedTabs } from "../../../ui/authenticated/AuthenticatedTabs.js"
import type { AuthenticatedActionMenuItem } from "../../../ui/authenticated/authenticatedActionMenuItem.js"
import type { AuthenticatedTabItem } from "../../../ui/authenticated/authenticatedTabItem.js"
import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import type { ConfirmState } from "../../../ui/confirm/confirmStateCreate.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { OrganizationRoleId } from "../../organizations/public/organizationRoleIdSchema.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import type { UserAuthenticationMethods } from "../../users/public/userAuthenticationMethodsSchema.js"
import type { DirectoryUserProfilePageState } from "./directoryUserProfilePageStateCreate.js"
import { directoryUserProfileStateTone } from "./directoryUserProfilePermissions.js"

export type DirectoryUserProfileViewState = {
  readonly asParam: (() => string | undefined) | undefined
  readonly basePath: string
  readonly confirmState: ConfirmState
  readonly dialog: () => "edit-profile" | "assign-roles" | "set-password" | "delete" | undefined
  readonly dialogOpenSet: (
    dialog: "edit-profile" | "assign-roles" | "set-password" | "delete" | undefined,
  ) => (open: boolean) => void
  readonly organizationName: () => string
  readonly page: DirectoryUserProfilePageState
  readonly tab: () => "overview" | "access" | "security"
  readonly userId: () => string | undefined
  readonly withActor: (href: string) => string
}

const organizationRoleIcons: Record<OrganizationRoleId, string> = {
  admin: mdiAccountCogOutline,
  guest: mdiAccountEyeOutline,
  member: mdiAccountOutline,
  owner: mdiShieldCrownOutline,
}

const sessionMethodKeys = {
  bootstrap_admin: "admin.signIn.title",
  email_otp: "login.chooser.emailOtpLabel",
  external_identity: "admin.organizations.policy.externalIdentity",
  impersonation: "admin.impersonation.title",
  passkey: "login.chooser.passkeyLabel",
  password: "login.chooser.passwordLabel",
  recovery_code: "login.mfa.recoveryCode",
  totp: "login.mfa.totp",
  whatsapp_otp: "login.chooser.emailOtpLabel",
} as const

/** The user profile page: header card with action menu, tabs, and shared stateless content. */
export function DirectoryUserProfileView(props: { readonly state: DirectoryUserProfileViewState }) {
  const state = props.state
  const page = () => state.page
  const user = () => page().profileGet()?.user

  const baseHref = () => `${state.basePath}/users/${state.userId() ?? ""}`
  const tabHref = (tab: "overview" | "access" | "security") =>
    state.withActor(tab === "overview" ? baseHref() : `${baseHref()}?tab=${tab}`)
  const tabs: AuthenticatedTabItem[] = [
    { href: tabHref("overview"), label: messageTranslate("admin.userProfile.overviewTab"), value: "overview" },
    { href: tabHref("access"), label: messageTranslate("admin.userProfile.accessTab"), value: "access" },
    { href: tabHref("security"), label: messageTranslate("admin.userProfile.securityTab"), value: "security" },
  ]
  const backHref = () => state.withActor(`${state.basePath}/users`)

  const actionItems = (): AuthenticatedActionMenuItem[] => {
    const current = user()
    if (current === undefined) return []
    const can = page().permissionsGet()
    const items: AuthenticatedActionMenuItem[] = []
    if (can.editProfile)
      items.push({
        icon: mdiPencil,
        label: messageTranslate("admin.userProfile.editProfile"),
        onSelect: () => state.dialogOpenSet("edit-profile")(true),
      })
    if (can.unlock && current.state === "locked")
      items.push({
        icon: mdiCheck,
        label: messageTranslate("admin.userProfile.unlock"),
        onSelect: () => void page().lifecycleSet("active"),
      })
    if (can.activate && current.state !== "active" && current.state !== "locked")
      items.push({
        icon: mdiCheck,
        label: messageTranslate("admin.userProfile.reactivate"),
        onSelect: () => void page().lifecycleSet("active"),
      })
    if (can.activate && current.state === "active")
      items.push({
        icon: mdiCheck,
        label: messageTranslate("admin.userProfile.deactivate"),
        onSelect: () => void page().lifecycleSet("inactive"),
      })
    if (can.impersonate && current.state === "active")
      items.push({
        icon: mdiAccountArrowRight,
        label: messageTranslate("admin.userProfile.impersonate"),
        onSelect: () => {
          window.location.assign(
            state.withActor(`${state.basePath}/impersonation?userId=${encodeURIComponent(current.id)}`),
          )
        },
      })
    if (can.setPassword)
      items.push({
        icon: mdiKeyChange,
        label: messageTranslate("admin.userProfile.setPassword"),
        onSelect: () => state.dialogOpenSet("set-password")(true),
      })
    if (can.grantRealmAdministrator)
      items.push({
        icon: mdiShieldCrownOutline,
        label: messageTranslate("admin.userProfile.makeRealmAdmin"),
        onSelect: () => void page().realmAdministratorGrant(),
      })
    if (can.revokeRealmAdministrator)
      items.push({
        icon: mdiShieldOutline,
        label: messageTranslate("admin.userProfile.removeRealmAdmin"),
        onSelect: () => void page().realmAdministratorRevoke(),
      })
    if (can.delete && current.state !== "deleted")
      items.push({
        icon: mdiDeleteOutline,
        label: messageTranslate("admin.userProfile.deleteConfirmTitle"),
        onSelect: () => state.dialogOpenSet("delete")(true),
        tone: "danger",
      })
    return items
  }

  const displayName = () => user()?.profile.displayName ?? user()?.userName ?? ""

  return (
    <AuthenticatedPageBody>
      <ConfirmDialog state={state.confirmState} titleKey="admin.common.confirmTitle" />
      <A
        class="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-accent hover:underline"
        href={backHref()}
      >
        <Icon aria-hidden="true" class="size-3.5" path={mdiArrowLeft} />
        {messageTranslate("admin.userProfile.backToUsers")}
      </A>

      <Show when={page().noticeGet()}>{(notice) => <AuthenticatedNotice message={notice()} />}</Show>

      <Show
        when={page().statusGet() !== "loading"}
        fallback={
          <div aria-label={messageTranslate("common.loading")} class="grid gap-4" role="status">
            <div class="grid gap-2 rounded-panel border border-line bg-surface p-5">
              <AuthenticatedSkeleton class="h-7 w-56" />
              <AuthenticatedSkeleton class="h-4 w-72" />
              <div class="mt-2 flex flex-wrap gap-1.5">
                <For each={[0, 1, 2]}>{(index) => <AuthenticatedSkeleton class="h-6 w-24" index={index} />}</For>
              </div>
            </div>
            <AuthenticatedSkeleton class="h-11 w-full" />
            <AuthenticatedSkeleton class="h-64 w-full" />
          </div>
        }
      >
        <Show
          when={page().statusGet() === "ready"}
          fallback={
            <ProductionStatePanel
              detail={page().errorGet()}
              onRetry={page().statusGet() === "error" ? page().reload : undefined}
              state={
                page().statusGet() === "expired" || page().statusGet() === "permission-denied"
                  ? "inaccessible"
                  : "error"
              }
            />
          }
        >
          <Show when={user()}>
            {(current) => (
              <>
                <AuthenticatedProfileHeader
                  actions={<AuthenticatedActionMenu items={actionItems()} />}
                  avatar={<AuthenticatedAvatar name={displayName()} size="xl" src={current().profile.picture?.url} />}
                  chips={
                    <>
                      <AuthenticatedChip
                        label={messageTranslate(
                          current().emailVerified
                            ? "admin.userProfile.emailVerified"
                            : "admin.userProfile.emailUnverified",
                        )}
                        tone={current().emailVerified ? "success" : "warning"}
                      />
                      <AuthenticatedChip
                        label={messageTranslate(`admin.users.lifecycle.${current().state}`)}
                        tone={directoryUserProfileStateTone(current().state)}
                      />
                      <For each={page().targetRolesGet() ?? []}>
                        {(role) => <AuthenticatedChip icon={organizationRoleIcons[role]} label={role} tone="accent" />}
                      </For>
                      <Show when={page().profileGet()?.access?.realmAdministrator}>
                        <AuthenticatedChip
                          icon={mdiShieldCrownOutline}
                          label={messageTranslate("admin.userProfile.realmAdminBadge")}
                          tone="accent"
                        />
                      </Show>
                    </>
                  }
                  meta={[
                    {
                      label: messageTranslate("admin.userProfile.lastSignIn"),
                      value: (
                        <AuthenticatedRelativeTime
                          fallback={
                            <span class="text-muted-foreground">{messageTranslate("admin.userProfile.never")}</span>
                          }
                          value={current().lastSignInAt}
                        />
                      ),
                    },
                    {
                      label: messageTranslate("admin.userProfile.memberSince"),
                      value: <span>{localeDateFormat(current().createdAt, { dateStyle: "medium" })}</span>,
                    },
                    {
                      label: messageTranslate("admin.userProfile.username"),
                      value: <span class="font-mono">@{current().userName}</span>,
                    },
                  ]}
                  subtitle={current().email}
                  title={displayName()}
                />

                <AuthenticatedTabs
                  active={state.tab()}
                  items={tabs}
                  label={messageTranslate("admin.users.detailTitle")}
                />

                <Show when={state.tab() === "overview"}>
                  <OverviewTab state={state} />
                </Show>
                <Show when={state.tab() === "access"}>
                  <AccessTab state={state} />
                </Show>
                <Show when={state.tab() === "security"}>
                  <SecurityTab state={state} />
                </Show>

                <EditProfileDialog state={state} />
                <SetPasswordDialog state={state} />
                <DeleteUserDialog state={state} />
                <AssignRolesDialog state={state} />
              </>
            )}
          </Show>
        </Show>
      </Show>
    </AuthenticatedPageBody>
  )
}

function OverviewTab(props: { readonly state: DirectoryUserProfileViewState }) {
  const page = () => props.state.page
  const user = () => page().profileGet()?.user
  return (
    <AuthenticatedSection
      actions={
        <Show when={page().permissionsGet().editProfile}>
          <AuthenticatedButton
            icon={mdiPencil}
            onClick={() => {
              const current = user()
              if (current === undefined) return
              page().profileEditLoad({
                profile: {
                  displayName: current.profile.displayName,
                  firstName: current.profile.firstName,
                  lastName: current.profile.lastName,
                  nickName: current.profile.nickName,
                  preferredLanguage: current.profile.preferredLanguage,
                },
                userName: current.userName,
              })
              props.state.dialogOpenSet("edit-profile")(true)
            }}
            size="sm"
            variant="outline"
          >
            {messageTranslate("admin.userProfile.editProfile")}
          </AuthenticatedButton>
        </Show>
      }
      padded
      title={messageTranslate("admin.userProfile.profileTitle")}
    >
      <Show
        when={user()}
        fallback={<AuthenticatedEmptyState title={messageTranslate("admin.userProfile.missingId")} />}
      >
        {(current) => (
          <div class="grid gap-6">
            <AuthenticatedFieldList
              columns={3}
              fields={[
                {
                  label: messageTranslate("admin.userProfile.username"),
                  value: <span class="font-mono">@{current().userName}</span>,
                },
                { label: messageTranslate("admin.userProfile.email"), value: current().email },
                {
                  label: messageTranslate("admin.userProfile.memberSince"),
                  value: localeDateFormat(current().createdAt, { dateStyle: "medium", timeStyle: "short" }),
                },
              ]}
            />
            <AuthenticatedSection padded title={messageTranslate("admin.userProfile.contactTitle")}>
              <AuthenticatedFieldList
                fields={[
                  { label: messageTranslate("admin.users.displayName"), value: current().profile.displayName ?? "—" },
                  { label: messageTranslate("admin.users.firstName"), value: current().profile.firstName ?? "—" },
                  { label: messageTranslate("admin.users.lastName"), value: current().profile.lastName ?? "—" },
                  { label: messageTranslate("admin.users.nickName"), value: current().profile.nickName ?? "—" },
                  {
                    label: messageTranslate("admin.userProfile.preferredLanguage"),
                    value: current().profile.preferredLanguage ?? "—",
                  },
                  { label: messageTranslate("admin.userProfile.phone"), value: current().phoneNumber ?? "—" },
                ]}
              />
            </AuthenticatedSection>
          </div>
        )}
      </Show>
    </AuthenticatedSection>
  )
}

function AccessTab(props: { readonly state: DirectoryUserProfileViewState }) {
  const page = () => props.state.page
  const can = () => page().permissionsGet()
  const membership = () => page().organizationMembershipGet()
  const assignments = () => page().assignmentGroups()
  return (
    <div class="grid gap-5">
      <AuthenticatedSection
        description={messageTranslate("admin.userProfile.organizationRoleDescription")}
        padded
        title={messageTranslate("admin.userProfile.organizationRoleTitle")}
      >
        <Show
          when={membership()}
          fallback={
            <AuthenticatedEmptyState
              actions={
                <Show when={can().manageOrganizationRole}>
                  <AuthenticatedButton
                    icon={mdiPlus}
                    onClick={() => void page().membershipAdd()}
                    size="sm"
                    variant="outline"
                  >
                    {messageTranslate("admin.userProfile.membershipAdd")}
                  </AuthenticatedButton>
                </Show>
              }
              description={messageTranslate("admin.userProfile.notMember")}
              title={messageTranslate("admin.userProfile.membershipsTitle")}
            />
          }
        >
          {(membershipEntry) => (
            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <For each={["owner", "admin", "member", "guest"] as const}>
                {(role) => (
                  <AuthenticatedOptionCard
                    bullets={[messageTranslate(`admin.roles.orgRole.${role}.bullet1`)]}
                    checkedRole="radio"
                    description={messageTranslate(`admin.roles.orgRole.${role}.description`)}
                    disabled={
                      !can().manageOrganizationRole ||
                      (role === "owner" &&
                        !page().actorGet().realmAdministrator &&
                        !page().actorGet().organizationRoles.includes("owner")) ||
                      page().pendingIdGet() !== undefined
                    }
                    icon={organizationRoleIcons[role]}
                    onSelect={() => void page().organizationRoleSingleSet(role)}
                    selected={membershipEntry().roles.includes(role)}
                    title={messageTranslate(
                      `admin.users.directoryRole${role[0]?.toUpperCase()}${role.slice(1)}` as never,
                    )}
                  />
                )}
              </For>
            </div>
          )}
        </Show>
        <Show when={page().formErrorGet()}>
          {(message) => <AuthenticatedNotice class="mt-3" message={message()} tone="danger" />}
        </Show>
      </AuthenticatedSection>

      <Show when={page().actorGet().realmAdministrator}>
        <AuthenticatedSection padded title={messageTranslate("admin.userProfile.membershipsTitle")}>
          <Show
            when={(page().profileGet()?.access?.memberships.length ?? 0) > 0}
            fallback={<AuthenticatedEmptyState title={messageTranslate("admin.userProfile.membershipEmpty")} />}
          >
            <AuthenticatedRecordList label={messageTranslate("admin.userProfile.membershipsTitle")}>
              <For each={page().profileGet()?.access?.memberships ?? []}>
                {(entry) => (
                  <AuthenticatedRecordItem
                    fields={[
                      {
                        label: messageTranslate("admin.userProfile.membershipOrganization"),
                        value: entry.organizationName,
                      },
                      {
                        label: messageTranslate("admin.users.directoryLastSignIn"),
                        value: localeDateFormat(entry.createdAt, { dateStyle: "medium" }),
                      },
                    ]}
                    status={
                      <For each={[...entry.roles]}>{(role) => <AuthenticatedChip label={role} tone="accent" />}</For>
                    }
                    title={entry.organizationName}
                  />
                )}
              </For>
            </AuthenticatedRecordList>
          </Show>
        </AuthenticatedSection>
      </Show>

      <AuthenticatedSection
        actions={
          <Show when={can().assignRoles}>
            <AuthenticatedButton
              icon={mdiPlus}
              onClick={() => {
                props.state.dialogOpenSet("assign-roles")(true)
                void dialogAssignOpen(props.state)
              }}
              size="sm"
              variant="outline"
            >
              {messageTranslate("admin.userProfile.assignRoles")}
            </AuthenticatedButton>
          </Show>
        }
        padded
        title={messageTranslate("admin.userProfile.projectRolesTitle")}
      >
        <Show
          when={assignments().length > 0}
          fallback={<AuthenticatedEmptyState title={messageTranslate("admin.userProfile.projectRolesEmpty")} />}
        >
          <div class="grid gap-3">
            <For each={assignments()}>
              {(assignment) => (
                <div class="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line-subtle px-3.5 py-2.5">
                  <div class="flex min-w-0 flex-wrap items-center gap-1.5">
                    <Icon aria-hidden="true" class="size-4 shrink-0 text-accent" path={mdiBriefcase} />
                    <span class="truncate text-sm font-medium">{assignment.projectName}</span>
                    <For each={assignment.roles}>
                      {(role) => <AuthenticatedChip label={role.displayName} tone="neutral" />}
                    </For>
                  </div>
                  <Show when={can().manageProjectAssignments}>
                    <AuthenticatedButton
                      disabled={page().pendingIdGet() !== undefined}
                      icon={mdiDeleteOutline}
                      onClick={() => void page().assignmentRemove(assignment.assignmentId, assignment.projectName)}
                      size="sm"
                      variant="outlineRed"
                    >
                      {messageTranslate("admin.userProfile.projectRolesRemove")}
                    </AuthenticatedButton>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
      </AuthenticatedSection>
    </div>
  )
}

function SecurityTab(props: { readonly state: DirectoryUserProfileViewState }) {
  const page = () => props.state.page
  return (
    <div class="grid gap-5">
      <Show when={page().noticeGet()}>{(notice) => <AuthenticatedNotice message={notice()} />}</Show>
      <AuthenticatedSection
        description={messageTranslate("admin.userProfile.authDescription")}
        title={messageTranslate("admin.userProfile.authTitle")}
      >
        <Show
          when={page().methodsStatusGet() !== "loading"}
          fallback={
            <div class="grid gap-2 px-5 py-4">
              <For each={[0, 1, 2]}>{(index) => <AuthenticatedSkeleton class="h-12" index={index} />}</For>
            </div>
          }
        >
          <Show
            when={page().methodsStatusGet() !== "error"}
            fallback={
              <div class="px-5 py-4">
                <ProductionStatePanel
                  compact
                  detail={page().methodsErrorGet()}
                  onRetry={page().methodsReload}
                  state="error"
                />
              </div>
            }
          >
            <Show when={page().methodsGet()}>{(methods) => <AuthenticationMethods methods={methods()} />}</Show>
          </Show>
        </Show>
      </AuthenticatedSection>

      <AuthenticatedSection
        actions={
          <Show when={page().sessionsGet().length > 0 && page().permissionsGet().activate}>
            <AuthenticatedButton
              disabled={page().pendingIdGet() !== undefined}
              icon={mdiLogout}
              onClick={() => void page().sessionsRevokeAll()}
              size="sm"
              variant="outlineRed"
            >
              {messageTranslate("admin.userProfile.revokeAll")}
            </AuthenticatedButton>
          </Show>
        }
        description={messageTranslate("admin.userProfile.sessionsDescription")}
        title={messageTranslate("admin.userProfile.sessionsTitle")}
      >
        <Show
          when={page().sessionsStatusGet() !== "loading"}
          fallback={
            <div class="grid gap-2 px-5 py-4">
              <For each={[0, 1]}>{(index) => <AuthenticatedSkeleton class="h-16" index={index} />}</For>
            </div>
          }
        >
          <Show
            when={page().sessionsStatusGet() !== "error"}
            fallback={
              <div class="px-5 py-4">
                <ProductionStatePanel
                  compact
                  detail={page().sessionsErrorGet()}
                  onRetry={page().sessionsReload}
                  state="error"
                />
              </div>
            }
          >
            <Show
              when={page().sessionsGet().length > 0}
              fallback={
                <div class="px-5 py-4">
                  <ProductionStatePanel
                    compact
                    state="empty"
                    title={messageTranslate("admin.userProfile.sessionsEmpty")}
                  />
                </div>
              }
            >
              <ul class="divide-y divide-line-subtle">
                <For each={page().sessionsGet()}>{(session) => <SessionRow page={page()} session={session} />}</For>
              </ul>
            </Show>
          </Show>
        </Show>
      </AuthenticatedSection>
    </div>
  )
}

function SessionRow(props: { readonly page: DirectoryUserProfilePageState; readonly session: Session }) {
  const metaClass = "flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground"
  return (
    <li class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 py-3.5">
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <Icon aria-hidden="true" class="size-4 shrink-0 text-muted-foreground" path={mdiMonitorCellphone} />
          <h3 class="truncate text-sm font-medium">
            {props.session.device.description ?? messageTranslate("account.sessions.unknownDevice")}
          </h3>
          <Show when={props.session.current}>
            <AuthenticatedStatus label={messageTranslate("account.sessions.current")} tone="success" />
          </Show>
        </div>
        <p class={`${metaClass} mt-1`}>
          <span>{messageTranslate(sessionMethodKeys[props.session.authenticationMethod])}</span>
          <span>
            {messageTranslate("admin.users.sessions.lastUsed")}:{" "}
            <AuthenticatedRelativeTime value={props.session.lastUsedAt} />
          </span>
          <span>
            {messageTranslate("admin.users.sessions.created")}:{" "}
            {localeDateFormat(props.session.createdAt, { dateStyle: "medium", timeStyle: "short" })}
          </span>
          <Show when={props.session.device.ipAddress}>
            {(ipAddress) => (
              <span class="font-mono">
                {messageTranslate("admin.users.sessions.ipAddress")}: {ipAddress()}
              </span>
            )}
          </Show>
        </p>
      </div>
      <Show when={props.page.permissionsGet().activate}>
        <AuthenticatedButton
          disabled={props.page.pendingIdGet() !== undefined}
          icon={mdiLogout}
          onClick={() => void props.page.sessionRevoke(props.session.id)}
          size="sm"
          variant="outline"
        >
          {messageTranslate("admin.userProfile.sessionsRevoke")}
        </AuthenticatedButton>
      </Show>
    </li>
  )
}

function AuthenticationMethods(props: { readonly methods: UserAuthenticationMethods }) {
  const metaClass = "flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground"
  return (
    <ul class="divide-y divide-line-subtle">
      <MethodRow
        detail={
          props.methods.password.available
            ? messageTranslate("account.status.configured")
            : messageTranslate("account.status.notConfigured")
        }
        icon={mdiKeyVariant}
        title={messageTranslate("login.chooser.passwordLabel")}
        tone={props.methods.password.available ? "success" : "neutral"}
      />
      <MethodRow
        detail={
          props.methods.emailOtp.available
            ? messageTranslate("account.status.available")
            : messageTranslate("account.status.notConfigured")
        }
        icon={mdiEmailOutline}
        title={messageTranslate("account.factors.emailOtp")}
        tone={props.methods.emailOtp.available ? "success" : "neutral"}
      />
      <MethodRow
        detail={
          props.methods.totp.enrolled
            ? messageTranslate("account.status.configured")
            : messageTranslate("account.status.notConfigured")
        }
        icon={mdiTwoFactorAuthentication}
        title={messageTranslate("account.factors.totp")}
        tone={props.methods.totp.enrolled ? "success" : "neutral"}
      >
        <For each={props.methods.totp.enrollments}>
          {(enrollment) => (
            <p class={metaClass}>
              {messageTranslate("admin.users.authentication.totpMetadata", {
                confirmed:
                  enrollment.confirmedAt === null
                    ? messageTranslate("admin.users.authentication.pending")
                    : localeDateFormat(enrollment.confirmedAt, { dateStyle: "medium", timeStyle: "short" }),
                label: enrollment.label,
              })}
            </p>
          )}
        </For>
      </MethodRow>
      <MethodRow
        detail={messageTranslate("account.factors.passkeyCount", { count: props.methods.passkeys.credentials.length })}
        icon={mdiFingerprint}
        title={messageTranslate("account.factors.passkeys")}
        tone={props.methods.passkeys.credentials.length > 0 ? "success" : "neutral"}
      >
        <For each={props.methods.passkeys.credentials}>
          {(credential) => (
            <p class={metaClass}>
              {messageTranslate("admin.users.authentication.passkeyMetadata", {
                created: localeDateFormat(credential.createdAt, { dateStyle: "medium" }),
                deviceType: credential.deviceType,
                lastUsed:
                  credential.lastUsedAt === null
                    ? messageTranslate("admin.users.authentication.neverUsed")
                    : localeDateFormat(credential.lastUsedAt, { dateStyle: "medium", timeStyle: "short" }),
              })}
            </p>
          )}
        </For>
      </MethodRow>
      <MethodRow
        detail={
          props.methods.recoveryCodes.available
            ? messageTranslate("admin.users.authentication.recoveryCount", {
                count: props.methods.recoveryCodes.remaining,
              })
            : messageTranslate("account.status.notConfigured")
        }
        icon={mdiCellphone}
        title={messageTranslate("admin.users.authentication.recoveryCodes")}
        tone={props.methods.recoveryCodes.available ? "success" : "neutral"}
      >
        <Show when={props.methods.recoveryCodes.generatedAt}>
          {(generatedAt) => (
            <p class={metaClass}>
              {messageTranslate("admin.users.authentication.generated", {
                date: localeDateFormat(generatedAt(), { dateStyle: "medium", timeStyle: "short" }),
              })}
            </p>
          )}
        </Show>
      </MethodRow>
    </ul>
  )
}

function MethodRow(props: {
  readonly children?: unknown
  readonly detail: string
  readonly icon: string
  readonly title: string
  readonly tone: "neutral" | "success"
}) {
  return (
    <li class="grid gap-2 px-5 py-3.5">
      <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 class="flex min-w-0 items-center gap-2 truncate text-sm font-medium">
          <Icon aria-hidden="true" class="size-4 shrink-0 text-muted-foreground" path={props.icon} />
          {props.title}
        </h3>
        <AuthenticatedStatus label={props.detail} tone={props.tone} />
      </div>
      {props.children as never}
    </li>
  )
}

function EditProfileDialog(props: { readonly state: DirectoryUserProfileViewState }) {
  const page = () => props.state.page
  const user = () => page().profileGet()?.user
  return (
    <AuthenticatedDialog
      onOpenChange={(open) => {
        if (!open) props.state.dialogOpenSet("edit-profile")(false)
      }}
      open={props.state.dialog() === "edit-profile"}
      title={messageTranslate("admin.userProfile.editProfileTitle")}
    >
      <form
        class="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void (async () => {
            const saved = await page().profileSave()
            if (saved) props.state.dialogOpenSet("edit-profile")(false)
          })()
        }}
      >
        <Show when={user()}>
          {(current) => (
            <div class="grid gap-4 sm:grid-cols-2">
              <ProfileField
                id="user-profile-display-name"
                label={messageTranslate("admin.users.displayName")}
                onInput={(value) => page().profileDraftSet("displayName", value)}
                value={page().profileDraftGet().displayName ?? current().profile.displayName ?? ""}
              />
              <ProfileField
                id="user-profile-first-name"
                label={messageTranslate("admin.users.firstName")}
                onInput={(value) => page().profileDraftSet("firstName", value)}
                value={page().profileDraftGet().firstName ?? current().profile.firstName ?? ""}
              />
              <ProfileField
                id="user-profile-last-name"
                label={messageTranslate("admin.users.lastName")}
                onInput={(value) => page().profileDraftSet("lastName", value)}
                value={page().profileDraftGet().lastName ?? current().profile.lastName ?? ""}
              />
              <ProfileField
                id="user-profile-nick-name"
                label={messageTranslate("admin.users.nickName")}
                onInput={(value) => page().profileDraftSet("nickName", value)}
                value={page().profileDraftGet().nickName ?? current().profile.nickName ?? ""}
              />
              <ProfileField
                id="user-profile-language"
                label={messageTranslate("admin.userProfile.preferredLanguage")}
                onInput={(value) => page().profileDraftSet("preferredLanguage", value)}
                value={page().profileDraftGet().preferredLanguage ?? current().profile.preferredLanguage ?? ""}
              />
            </div>
          )}
        </Show>
        <Show when={page().formErrorGet()}>
          {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
        </Show>
        <div class="flex justify-end gap-2">
          <AuthenticatedButton
            disabled={page().pendingIdGet() !== undefined}
            icon={mdiContentSave}
            type="submit"
            variant="filledBlue"
          >
            {messageTranslate("common.save")}
          </AuthenticatedButton>
        </div>
      </form>
    </AuthenticatedDialog>
  )
}

function ProfileField(props: {
  readonly id: string
  readonly label: string
  readonly onInput: (value: string) => void
  readonly value: string
}) {
  return (
    <div class="grid gap-1.5">
      <Label class="text-[0.8125rem] font-medium" for={props.id}>
        {props.label}
      </Label>
      <AuthenticatedInput
        id={props.id}
        maxlength={128}
        onInput={(event) => props.onInput(event.currentTarget.value)}
        value={props.value}
      />
    </div>
  )
}

function SetPasswordDialog(props: { readonly state: DirectoryUserProfileViewState }) {
  const page = () => props.state.page
  return (
    <AuthenticatedDialog
      description={messageTranslate("admin.userProfile.setPasswordDescription")}
      onOpenChange={(open) => {
        if (!open) props.state.dialogOpenSet("set-password")(false)
      }}
      open={props.state.dialog() === "set-password"}
      title={messageTranslate("admin.userProfile.setPasswordTitle")}
    >
      <form
        class="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void (async () => {
            const saved = await page().passwordSubmit()
            if (saved) props.state.dialogOpenSet("set-password")(false)
          })()
        }}
      >
        <div class="grid gap-1.5">
          <Label class="text-[0.8125rem] font-medium" for="user-profile-password">
            {messageTranslate("admin.userProfile.passwordNew")}
          </Label>
          <AuthenticatedInput
            autocomplete="new-password"
            id="user-profile-password"
            onInput={(event) => page().passwordSet(event.currentTarget.value)}
            type="password"
            value={page().passwordGet()}
          />
        </div>
        <div class="grid gap-1.5">
          <Label class="text-[0.8125rem] font-medium" for="user-profile-password-confirm">
            {messageTranslate("admin.userProfile.passwordConfirm")}
          </Label>
          <AuthenticatedInput
            autocomplete="new-password"
            id="user-profile-password-confirm"
            onInput={(event) => page().passwordConfirmSet(event.currentTarget.value)}
            type="password"
            value={page().passwordConfirmGet()}
          />
        </div>
        <Show when={page().formErrorGet()}>
          {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
        </Show>
        <div class="flex justify-end gap-2">
          <AuthenticatedButton
            disabled={page().pendingIdGet() !== undefined}
            icon={mdiKeyChange}
            type="submit"
            variant="filledBlue"
          >
            {messageTranslate("admin.userProfile.setPassword")}
          </AuthenticatedButton>
        </div>
      </form>
    </AuthenticatedDialog>
  )
}

function DeleteUserDialog(props: { readonly state: DirectoryUserProfileViewState }) {
  const page = () => props.state.page
  const user = () => page().profileGet()?.user
  const close = () => {
    page().deleteConfirmSet("")
    props.state.dialogOpenSet("delete")(false)
  }
  return (
    <AuthenticatedDialog
      description={messageTranslate("admin.users.deleteWarning")}
      onOpenChange={(open) => {
        if (!open) close()
      }}
      open={props.state.dialog() === "delete" && user() !== undefined}
      title={messageTranslate("admin.userProfile.deleteConfirmTitle")}
    >
      <DeleteUserBody close={close} state={props.state} />
    </AuthenticatedDialog>
  )
}

function DeleteUserBody(props: { readonly close: () => void; readonly state: DirectoryUserProfileViewState }) {
  const page = () => props.state.page
  const user = () => page().profileGet()?.user
  return (
    <Show when={user()}>
      {(current) => (
        <form
          class="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void (async () => {
              const removed = await page().deleteSubmit()
              if (removed) {
                props.close()
                window.location.assign(props.state.withActor(`${props.state.basePath}/users`))
              }
            })()
          }}
        >
          <p class="text-sm text-muted-foreground">
            {messageTranslate("admin.userProfile.deleteConfirm", { userName: current().userName })}
          </p>
          <p class="text-sm text-muted-foreground">
            {messageTranslate("admin.userProfile.deleteConfirmType", { userName: current().userName })}
          </p>
          <div class="grid gap-1.5">
            <Label class="text-[0.8125rem] font-medium" for="user-profile-delete-confirm">
              {messageTranslate("admin.userProfile.username")}
            </Label>
            <AuthenticatedInput
              autocomplete="off"
              id="user-profile-delete-confirm"
              onInput={(event) => page().deleteConfirmSet(event.currentTarget.value)}
              value={page().deleteConfirmGet()}
            />
          </div>
          <Show when={page().formErrorGet()}>
            {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
          </Show>
          <div class="flex justify-end gap-2">
            <AuthenticatedButton
              disabled={page().pendingIdGet() !== undefined}
              icon={mdiDeleteOutline}
              type="submit"
              variant="filledRed"
            >
              {messageTranslate("admin.userProfile.deleteConfirmTitle")}
            </AuthenticatedButton>
          </div>
        </form>
      )}
    </Show>
  )
}

async function dialogAssignOpen(state: DirectoryUserProfileViewState) {
  await state.page.projectsEnsure()
  const projects = state.page.projectsGet()
  if (projects.length > 0) await state.page.assignRolesLoad(projects[0]?.id ?? "")
}

function AssignRolesDialog(props: { readonly state: DirectoryUserProfileViewState }) {
  const page = () => props.state.page
  const opened = () => props.state.dialog() === "assign-roles"
  const dialogQuery = () => page().assignSearchGet().trim().toLowerCase()
  const dialogProjects = () =>
    page()
      .projectsGet()
      .filter((project) => dialogQuery().length === 0 || project.name.toLowerCase().includes(dialogQuery()))
  const dialogProjectsLoad = async () => {
    await page().projectsEnsure()
    const projects = page().projectsGet()
    if (projects.length > 0) await page().assignRolesLoad(projects[0]?.id ?? "")
  }
  createEffect(() => {
    if (!opened()) return
    if (page().projectsGet().length === 0) {
      void dialogProjectsLoad()
      return
    }
    if (page().assignProjectId.get().length === 0) {
      const first = page().projectsGet()[0]
      if (first !== undefined) void page().assignRolesLoad(first.id)
    }
  })
  const selected = () =>
    page()
      .projectRolesGet()
      .filter((role) => page().assignRoleKeysGet().includes(role.key))
  return (
    <AuthenticatedDialog
      description={messageTranslate("admin.userProfile.assignRolesStepProject")}
      onOpenChange={(open) => {
        if (!open) props.state.dialogOpenSet("assign-roles")(false)
      }}
      open={props.state.dialog() === "assign-roles"}
      title={messageTranslate("admin.userProfile.assignRolesDialogTitle")}
    >
      <div class="grid gap-4">
        <Show when={page().pendingIdGet() === undefined && dialogProjects().length === 0}>
          <AuthenticatedEmptyState title={messageTranslate("admin.userProfile.assignRolesEmpty")} />
        </Show>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="grid content-start gap-2">
            <AuthenticatedSearchField
              onInput={(value) => page().assignSearchSet(value)}
              placeholder={messageTranslate("admin.userProfile.assignRolesSearch")}
              value={page().assignSearchGet()}
            />
            <div
              class="grid gap-1.5"
              role="listbox"
              aria-label={messageTranslate("admin.userProfile.assignRolesProject")}
            >
              <For each={dialogProjects()}>
                {(project) => (
                  <button
                    aria-selected={page().assignProjectId.get() === project.id}
                    class={`flex items-center justify-between gap-2 rounded-control border px-3 py-2 text-left text-sm font-medium transition-colors ${
                      page().assignProjectId.get() === project.id
                        ? "border-accent/50 bg-accent-soft"
                        : "border-line bg-surface hover:border-line-strong"
                    }`}
                    onClick={() => void page().assignRolesLoad(project.id)}
                    role="option"
                    type="button"
                  >
                    <span class="flex min-w-0 items-center gap-2">
                      <Icon aria-hidden="true" class="size-4 shrink-0 text-accent" path={mdiBriefcase} />
                      <span class="truncate">{project.name}</span>
                    </span>
                    <Show when={project.owned}>
                      <AuthenticatedChip label={messageTranslate("admin.roles.projects.owned")} tone="accent" />
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </div>
          <div class="grid content-start gap-2">
            <p class="text-[0.8125rem] font-medium">{messageTranslate("admin.userProfile.assignRolesRoles")}</p>
            <AuthenticatedSelect
              getOptions={() =>
                page()
                  .projectsGet()
                  .map((project) => project.id)
              }
              id="user-profile-assign-project"
              valueSignal={page().assignProjectId}
              valueText={(id) =>
                page()
                  .projectsGet()
                  .find((project) => project.id === id)?.name ?? id
              }
            />
            <Show
              when={page().projectRolesGet().length > 0}
              fallback={
                <p class="text-xs text-muted-foreground">{messageTranslate("admin.userProfile.assignRolesEmpty")}</p>
              }
            >
              <div class="grid gap-1.5">
                <For each={page().projectRolesGet()}>
                  {(role) => (
                    <label class="flex cursor-pointer items-center gap-2 rounded-control border border-line px-3 py-2 text-sm">
                      <input
                        checked={page().assignRoleKeysGet().includes(role.key)}
                        class="size-4 accent-[var(--color-accent)]"
                        onChange={() => page().assignRoleToggle(role.key)}
                        type="checkbox"
                      />
                      <span class="min-w-0 flex-1">
                        <span class="block truncate font-medium">{role.displayName}</span>
                        <span class="block truncate font-mono text-xs text-muted-foreground">{role.key}</span>
                      </span>
                    </label>
                  )}
                </For>
              </div>
            </Show>
            <p class="text-xs text-muted-foreground">
              {messageTranslate("admin.userProfile.assignRolesSelected", { count: selected().length })}
            </p>
          </div>
        </div>
        <Show when={page().formErrorGet()}>
          {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
        </Show>
        <div class="flex justify-end gap-2">
          <AuthenticatedButton
            disabled={page().pendingIdGet() !== undefined}
            icon={mdiContentSave}
            onClick={() =>
              void (async () => {
                const saved = await page().assignRolesSave()
                if (saved) props.state.dialogOpenSet("assign-roles")(false)
              })()
            }
            variant="filledBlue"
          >
            {messageTranslate("admin.userProfile.assignRolesSave")}
          </AuthenticatedButton>
        </div>
      </div>
    </AuthenticatedDialog>
  )
}
