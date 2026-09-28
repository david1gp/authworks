import { Show } from "solid-js"
import { mdiOfficeBuildingOutline } from "@adaptive-ds/mdi/mdiOfficeBuildingOutline.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OrganizationMe } from "../../organizations/public/organizationMeSchema.js"
import type { AccountEffectiveAccessGroup } from "../public/accountEffectiveAccessGroupSchema.js"
import { AccountDisclosure } from "./AccountDisclosure.js"
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
  readonly onOrganizationRetry: () => void
  readonly onOrganizationSelect: (organizationId: string) => void
  readonly organizationError?: string
  readonly organizations: readonly OrganizationMe[]
  readonly organizationStatus: AccountAccessStatus
  readonly viewedOrganization?: OrganizationMe
  readonly viewedOrganizationId?: string
}) {
  const state = accountOrganizationAccessViewStateCreate({
    effectiveAccessError: () => props.effectiveAccessError,
    effectiveAccessStatus: () => props.effectiveAccessStatus,
    organizationError: () => props.organizationError,
    organizationStatus: () => props.organizationStatus,
    organizations: () => props.organizations,
  })

  return (
    <AccountDisclosure
      icon={mdiOfficeBuildingOutline}
      summary={messageTranslate("shell.nav.organizations")}
      value={state.organizationSummary()}
      variant="card"
    >
      <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
        <p class="text-sm text-muted-foreground">{messageTranslate("account.access.organizationDescription")}</p>
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
              onEffectiveAccessLoadMore={props.onEffectiveAccessLoadMore}
              onEffectiveAccessRetry={props.onEffectiveAccessRetry}
            />
          )}
        </Show>
      </div>
    </AccountDisclosure>
  )
}
