import { Match, Switch } from "solid-js"
import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { OrganizationAdminBrandingView } from "./OrganizationAdminBrandingView.js"
import { OrganizationAdminDetailView } from "./OrganizationAdminDetailView.js"
import { OrganizationAdminDomainsView } from "./OrganizationAdminDomainsView.js"
import { OrganizationAdminInvitationsView } from "./OrganizationAdminInvitationsView.js"
import { OrganizationAdminListView } from "./OrganizationAdminListView.js"
import { OrganizationAdminLoginPolicyView } from "./OrganizationAdminLoginPolicyView.js"
import { OrganizationAdminMembershipsView } from "./OrganizationAdminMembershipsView.js"
import type { organizationAdminScreenStateCreate } from "./organizationAdminScreenStateCreate.js"

type OrganizationAdminScreenState = ReturnType<typeof organizationAdminScreenStateCreate>

/** Renders any organization administration screen purely from the shared state; no adapter knowledge here. */
export function OrganizationAdminScreenView(props: { readonly state: OrganizationAdminScreenState }) {
  const state = props.state
  return (
    <>
      <ConfirmDialog state={state.confirmState} titleKey="admin.common.confirmTitle" />
      <Switch>
        <Match when={state.page.screen() === "organizations"}>
          <OrganizationAdminListView
            createName={state.form.createName.get()}
            createOpen={state.createOpen()}
            detailHrefBuild={state.detailHrefBuild}
            error={state.page.error()}
            nextPageAvailable={state.page.nextPageAvailable()}
            notice={state.page.notice()}
            onCreateNameInput={state.form.createName.set}
            onCreateOpenChange={state.createOpenSet}
            onCreateSubmit={state.organizationCreateSubmit}
            onNextPage={state.page.nextPageOpen}
            onPreviousPage={state.page.previousPageOpen}
            onRetry={state.page.reload}
            onSearchInput={state.searchSet}
            organizations={state.filteredOrganizations()}
            pendingId={state.page.pendingId?.()}
            previousPageAvailable={state.page.previousPageAvailable()}
            search={state.form.search.get()}
            status={state.page.status()}
            validationMessage={state.form.validationMessage.get()}
          />
        </Match>
        <Match when={state.page.screen() === "organization-detail"}>
          <OrganizationAdminDetailView
            backHref={state.listHref()}
            error={state.page.error()}
            memberships={state.page.memberships()}
            membershipsHref={state.membershipsHref()}
            name={state.form.detailName.get()}
            notice={state.page.notice()}
            onLifecycleSet={state.page.organizationLifecycleSet}
            onNameInput={state.form.detailName.set}
            onRenameSubmit={state.organizationRenameSubmit}
            onRetry={state.page.reload}
            organization={state.page.organization()}
            pendingId={state.page.pendingId?.()}
            status={state.page.status()}
          />
        </Match>
        <Match when={state.page.screen() === "memberships"}>
          <OrganizationAdminMembershipsView
            addRoles={state.form.membershipRoles.get()}
            addUserId={state.form.membershipUserId.get()}
            error={state.page.error()}
            memberships={state.page.memberships()}
            nextPageAvailable={state.page.nextPageAvailable()}
            notice={state.page.notice()}
            onAddRoleToggle={state.form.membershipRolesToggle}
            onAddSubmit={state.membershipAddSubmit}
            onAddUserIdInput={state.form.membershipUserId.set}
            onNextPage={state.page.nextPageOpen}
            onPreviousPage={state.page.previousPageOpen}
            onRemove={state.page.membershipRemove}
            onRetry={state.page.reload}
            onRoleToggle={state.membershipRoleToggle}
            pendingId={state.page.pendingId?.()}
            previousPageAvailable={state.page.previousPageAvailable()}
            roles={state.page.roles()}
            status={state.page.status()}
            validationMessage={state.form.validationMessage.get()}
          />
        </Match>
        <Match when={state.page.screen() === "invitations"}>
          <OrganizationAdminInvitationsView
            email={state.form.invitationEmail.get()}
            error={state.page.error()}
            invitations={state.page.invitations()}
            invitationToken={state.page.invitationToken()}
            nextPageAvailable={state.page.nextPageAvailable()}
            notice={state.page.notice()}
            onEmailInput={state.form.invitationEmail.set}
            onNextPage={state.page.nextPageOpen}
            onPreviousPage={state.page.previousPageOpen}
            onRetry={state.page.reload}
            onRevoke={state.page.invitationRevoke}
            onRoleToggle={state.form.invitationRolesToggle}
            onSubmit={state.invitationCreateSubmit}
            onTokenDismiss={state.page.invitationTokenDismiss}
            pendingId={state.page.pendingId?.()}
            previousPageAvailable={state.page.previousPageAvailable()}
            roles={state.page.roles()}
            selectedRoles={state.form.invitationRoles.get()}
            status={state.page.status()}
            validationMessage={state.form.validationMessage.get()}
          />
        </Match>
        <Match when={state.page.screen() === "domains"}>
          <OrganizationAdminDomainsView
            claimDomain={state.form.claimDomain.get()}
            claimPrimary={state.form.claimPrimary.get()}
            discoveryDomain={state.form.discoveryDomain.get()}
            discoveryMessage={state.form.discoveryMessage.get()}
            domains={state.page.domains()}
            error={state.page.error()}
            nextPageAvailable={state.page.nextPageAvailable()}
            notice={state.page.notice()}
            onClaimDomainInput={state.form.claimDomain.set}
            onClaimPrimaryToggle={() => state.form.claimPrimary.set(!state.form.claimPrimary.get())}
            onClaimSubmit={state.domainClaimSubmit}
            onDiscoveryDomainInput={state.form.discoveryDomain.set}
            onDiscoverySubmit={state.domainDiscoverySubmit}
            onNextPage={state.page.nextPageOpen}
            onPreviousPage={state.page.previousPageOpen}
            onRemove={state.page.domainRemove}
            onRetry={state.page.reload}
            onVerify={state.page.domainVerify}
            pendingId={state.page.pendingId?.()}
            previousPageAvailable={state.page.previousPageAvailable()}
            status={state.page.status()}
            validationMessage={state.form.validationMessage.get()}
          />
        </Match>
        <Match when={state.page.screen() === "branding"}>
          <OrganizationAdminBrandingView
            branding={state.branding()}
            error={state.page.error()}
            notice={state.page.notice()}
            onLegalUrlInput={state.brandingLegalUrlSet}
            onRetry={state.page.reload}
            onSubmit={state.brandingSubmit}
            onThemeAssetInput={state.brandingThemeAssetSet}
            onThemeColorInput={state.brandingThemeColorSet}
            onThemeModeInput={state.brandingThemeModeSet}
            onWatermarkToggle={state.brandingWatermarkToggle}
            pendingId={state.page.pendingId?.()}
            status={state.page.status()}
            validationMessage={state.form.validationMessage.get()}
          />
        </Match>
        <Match when={state.page.screen() === "login-policy"}>
          <OrganizationAdminLoginPolicyView
            error={state.page.error()}
            notice={state.page.notice()}
            onPolicySubmit={state.policySubmit}
            onPolicyToggle={state.policyToggle}
            onProviderAccountCreationToggle={state.providerAccountCreationToggle}
            onProviderCreateInput={state.providerCreateInput}
            onProviderCreateSubmit={state.providerCreateSubmit}
            onProviderCreateTypeInput={state.providerCreateTypeSet}
            onProviderDisable={state.page.providerDisable}
            onProviderEnabledToggle={state.providerEnabledToggle}
            onProviderSecretInput={state.form.providerSecretSet}
            onProviderSecretRotate={state.providerSecretRotate}
            onRetry={state.page.reload}
            overrides={state.page.overrides()}
            pendingId={state.page.pendingId?.()}
            policy={state.policyDraft()}
            providerCreate={state.form.providerCreate.get()}
            providers={state.page.providers()}
            providerSecrets={state.form.providerSecrets.get()}
            status={state.page.status()}
            validationMessage={state.form.validationMessage.get()}
          />
        </Match>
      </Switch>
    </>
  )
}
