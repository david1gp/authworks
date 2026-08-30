import { Show } from "solid-js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OrganizationMe } from "../../organizations/public/organizationMeSchema.js"
import type { AccountEffectiveAccessGroup } from "../public/accountEffectiveAccessGroupSchema.js"
import { AccountOrganizationPanel } from "./AccountOrganizationPanel.js"
import { AccountOrganizationSelector } from "./AccountOrganizationSelector.js"
import { AccountStateBoundary } from "./AccountStateBoundary.js"
import type { AccountAccessStatus } from "./accountAccessStatusSchema.js"
import { accountOrganizationAccessViewStateCreate } from "./accountOrganizationAccessViewStateCreate.js"

export function AccountOrganizationAccessView(props: {
  readonly activeOrganizationId?: string
  readonly effectiveAccessError?: string
  readonly effectiveAccessGroup?: AccountEffectiveAccessGroup
  readonly effectiveAccessNextPageToken?: string
  readonly effectiveAccessPending: boolean
  readonly effectiveAccessStatus: AccountAccessStatus
  readonly onEffectiveAccessLoadMore: () => void
  readonly onEffectiveAccessRetry: () => void
  readonly onOrganizationActivate: (organizationId: string) => void
  readonly onOrganizationRetry: () => void
  readonly onOrganizationSelect: (organizationId: string) => void
  readonly organizationError?: string
  readonly organizationNotice?: string
  readonly organizations: readonly OrganizationMe[]
  readonly organizationStatus: AccountAccessStatus
  readonly pending: boolean
  readonly viewedOrganization?: OrganizationMe
  readonly viewedOrganizationId?: string
}) {
  const state = accountOrganizationAccessViewStateCreate({
    effectiveAccessError: () => props.effectiveAccessError,
    effectiveAccessStatus: () => props.effectiveAccessStatus,
    organizationError: () => props.organizationError,
    organizationStatus: () => props.organizationStatus,
  })

  return (
    <section
      aria-label={messageTranslate("account.access.organizationSelector")}
      class="grid min-w-0 gap-3 [&>*]:min-w-0"
    >
      <p class="text-sm text-muted-foreground">{messageTranslate("account.access.organizationDescription")}</p>

      <Show when={props.organizationNotice}>
        {(organization) => (
          <AuthenticatedNotice
            message={messageTranslate("account.access.switched", { organization: organization() })}
          />
        )}
      </Show>

      <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
        <AccountStateBoundary
          detail={state.organizationBoundary().detail}
          onRetry={props.onOrganizationRetry}
          state={props.viewedOrganization ? "ready" : state.organizationBoundary().state}
        >
          <AccountOrganizationSelector
            activeOrganizationId={props.activeOrganizationId}
            onSelect={props.onOrganizationSelect}
            organizations={props.organizations}
            panelId="account-access-organization-panel"
            viewedOrganizationId={props.viewedOrganizationId}
          />
        </AccountStateBoundary>

        <Show
          when={props.viewedOrganization}
          fallback={<p class="text-sm text-muted-foreground">{messageTranslate("account.access.organizationEmpty")}</p>}
        >
          {(membership) => (
            <AccountOrganizationPanel
              active={membership().organization.id === props.activeOrganizationId}
              effectiveAccessBoundary={state.effectiveAccessBoundary()}
              effectiveAccessNextPageToken={props.effectiveAccessNextPageToken}
              effectiveAccessPending={props.effectiveAccessPending}
              group={props.effectiveAccessGroup}
              id="account-access-organization-panel"
              membership={membership()}
              onActivate={props.onOrganizationActivate}
              onEffectiveAccessLoadMore={props.onEffectiveAccessLoadMore}
              onEffectiveAccessRetry={props.onEffectiveAccessRetry}
              pending={props.pending}
            />
          )}
        </Show>
      </div>
    </section>
  )
}
