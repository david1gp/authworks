import { AccountOrganizationAccessView } from "./AccountOrganizationAccessView.js"
import { accountOrganizationAccessProductionStateCreate } from "./accountOrganizationAccessProductionStateCreate.js"

export function AccountOrganizationAccessProductionAdapter() {
  const state = accountOrganizationAccessProductionStateCreate()
  return (
    <AccountOrganizationAccessView
      activeOrganizationId={state.organizations.activeOrganizationId()}
      effectiveAccessError={state.effectiveAccess.error()}
      effectiveAccessGroup={state.effectiveAccess.viewedEffectiveAccessGroup()}
      effectiveAccessNextPageToken={state.effectiveAccess.effectiveAccessNextPageToken()}
      effectiveAccessPending={state.effectiveAccess.pendingId() !== undefined}
      effectiveAccessStatus={state.effectiveAccess.status()}
      onEffectiveAccessLoadMore={state.effectiveAccess.effectiveAccessLoadMore}
      onEffectiveAccessRetry={state.effectiveAccess.reload}
      onOrganizationActivate={state.organizations.organizationSwitch}
      onOrganizationRetry={state.organizations.reload}
      onOrganizationSelect={state.organizationSelect}
      organizationError={state.organizations.error()}
      organizationNotice={state.organizations.notice()}
      organizations={state.organizations.organizations()}
      organizationStatus={state.organizations.status()}
      pending={state.organizations.pendingId() !== undefined}
      viewedOrganization={state.organizations.viewedOrganization()}
      viewedOrganizationId={state.organizations.viewedOrganizationId()}
    />
  )
}
