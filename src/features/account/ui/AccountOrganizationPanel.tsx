import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OrganizationMe } from "../../organizations/public/organizationMeSchema.js"
import type { AccountEffectiveAccessGroup } from "../public/accountEffectiveAccessGroupSchema.js"
import { AccountDisclosure } from "./AccountDisclosure.js"
import { AccountRoleList } from "./AccountRoleList.js"
import { AccountStateBoundary } from "./AccountStateBoundary.js"
import { accountAccessBoundaryStateGet } from "./accountAccessBoundaryStateGet.js"
import { accountEffectiveAccessSourceGet } from "./accountEffectiveAccessSourceGet.js"
import { accountOrganizationPanelStateCreate } from "./accountOrganizationPanelStateCreate.js"

/**
 * Detail panel of the organization selected in the Access section. It shows only member-visible,
 * organization-scoped data and offers one explicit activation action, so viewing an organization
 * never changes the session context by itself.
 */
export function AccountOrganizationPanel(props: {
  readonly active: boolean
  readonly effectiveAccessBoundary: ReturnType<typeof accountAccessBoundaryStateGet>
  readonly effectiveAccessNextPageToken?: string
  readonly effectiveAccessPending: boolean
  readonly group?: AccountEffectiveAccessGroup
  readonly id: string
  readonly membership: OrganizationMe
  readonly onActivate: (organizationId: string) => void
  readonly onEffectiveAccessLoadMore: () => void
  readonly onEffectiveAccessRetry: () => void
  readonly pending: boolean
}) {
  const state = accountOrganizationPanelStateCreate({
    group: () => props.group,
    organizationId: () => props.membership.organization.id,
  })
  return (
    <div aria-labelledby={state.tabId(props.id)} class="grid min-w-0 gap-3 [&>*]:min-w-0" id={props.id} role="tabpanel">
      <AuthenticatedSection padded title={props.membership.organization.name}>
        <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <p class="min-w-0 truncate font-mono text-xs text-muted-foreground">{props.membership.organization.id}</p>
          <AuthenticatedStatus
            label={messageTranslate(`admin.organizations.statusValue.${props.membership.organization.status}`)}
            tone={props.membership.organization.status === "active" ? "success" : "neutral"}
          />
          <Show when={props.active}>
            <AuthenticatedStatus label={messageTranslate("account.access.active")} tone="accent" />
          </Show>
        </div>

        <div class="mt-2.5 grid gap-1">
          <p class="text-2xs font-semibold tracking-[0.12em] uppercase text-muted-foreground">
            {messageTranslate("account.access.membership")}
          </p>
          <AccountRoleList values={props.membership.membership.roles} />
        </div>

        {/* The activation action stays explicit so that inspecting an organization is read-only. */}
        <Show when={!props.active}>
          <div class="mt-2.5">
            <Button
              disabled={props.pending}
              onClick={() => props.onActivate(props.membership.organization.id)}
              size="sm"
              variant="outline"
            >
              {messageTranslate("account.access.makeActiveOrganization")}
            </Button>
          </div>
        </Show>
      </AuthenticatedSection>

      <AccountStateBoundary
        detail={props.effectiveAccessBoundary.detail}
        onRetry={props.onEffectiveAccessRetry}
        state={props.effectiveAccessBoundary.state}
      >
        <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
          <AuthenticatedSection
            padded
            title={messageTranslate("account.access.organizationAccess")}
            description={messageTranslate("account.access.effectiveMembership", {
              roles: props.membership.membership.roles.join(", "),
            })}
          >
            <Show
              when={state.organizationPermissions().length > 0}
              fallback={
                <p class="text-xs text-muted-foreground">{messageTranslate("account.access.effectiveEmpty")}</p>
              }
            >
              <p class="min-w-0 text-xs text-muted-foreground">
                {messageTranslate("account.access.effectivePermissions", {
                  permissions: state.organizationPermissions().join(", "),
                })}
              </p>
            </Show>
          </AuthenticatedSection>

          <AuthenticatedSection title={messageTranslate("account.access.effectiveTitle")}>
            <Show
              when={state.projectEntries().length > 0}
              fallback={
                <p class="px-3 py-2.5 text-xs text-muted-foreground">
                  {messageTranslate("account.access.effectiveEmpty")}
                </p>
              }
            >
              {/* Two project cards fit a desktop row while a phone keeps one readable column. */}
              <ul class="grid min-w-0 gap-3 px-3 py-3 lg:grid-cols-2 [&>*]:min-w-0">
                <For each={state.projectEntries()}>
                  {(entry) => {
                    const source = () => accountEffectiveAccessSourceGet(entry)
                    return (
                      <li class="min-w-0">
                        <AuthenticatedSection class="h-full" padded>
                          <div class="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                            <h3 class="min-w-0 truncate text-sm font-semibold tracking-tight">{entry.project?.name}</h3>
                            <Show when={entry.project?.status}>
                              {(status) => (
                                <AuthenticatedStatus
                                  label={messageTranslate(`admin.projects.statusValue.${status()}`)}
                                  tone={status() === "active" ? "success" : "neutral"}
                                />
                              )}
                            </Show>
                          </div>
                          <p class="mt-1 min-w-0 text-xs text-muted-foreground">
                            {messageTranslate("account.access.roles", { roles: entry.roleKeys.join(", ") })}
                          </p>
                          <p class="mt-0.5 min-w-0 truncate font-mono text-xs text-muted-foreground">
                            {messageTranslate("account.access.effectiveSource", { source: source() })}
                          </p>
                          <Show when={entry.grant}>
                            {(grant) => (
                              <div class="mt-1.5 grid gap-1">
                                <p class="text-2xs font-semibold tracking-[0.12em] uppercase text-muted-foreground">
                                  {messageTranslate("admin.projects.grants.grantedOrganization")}
                                </p>
                                <p class="min-w-0 truncate font-mono text-xs text-muted-foreground">
                                  {grant().grantedOrganizationId}
                                </p>
                                <p class="text-2xs font-semibold tracking-[0.12em] uppercase text-muted-foreground">
                                  {messageTranslate("admin.projects.grants.roleKeys")}
                                </p>
                                <AccountRoleList values={grant().roleKeys} />
                              </div>
                            )}
                          </Show>
                          <AccountDisclosure
                            class="mt-2.5"
                            summary={messageTranslate("account.access.permissionsToggle", {
                              count: String(entry.permissions.length),
                              source: source(),
                            })}
                          >
                            <p class="min-w-0 text-xs text-muted-foreground">
                              {messageTranslate("account.access.effectivePermissions", {
                                permissions: entry.permissions.join(", "),
                              })}
                            </p>
                          </AccountDisclosure>
                        </AuthenticatedSection>
                      </li>
                    )
                  }}
                </For>
              </ul>
            </Show>
          </AuthenticatedSection>

          <Show when={props.effectiveAccessNextPageToken}>
            <div>
              <Button
                disabled={props.effectiveAccessPending}
                onClick={props.onEffectiveAccessLoadMore}
                size="sm"
                type="button"
                variant="outline"
              >
                {messageTranslate("account.access.loadMore")}
              </Button>
            </div>
          </Show>
        </div>
      </AccountStateBoundary>
    </div>
  )
}
