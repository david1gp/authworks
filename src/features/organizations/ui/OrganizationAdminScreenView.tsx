import { Match, Switch } from "solid-js"
import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { OrganizationAdminDetailView } from "./OrganizationAdminDetailView.js"
import { OrganizationAdminListView } from "./OrganizationAdminListView.js"
import { OrganizationAdminLoginPolicyView } from "./OrganizationAdminLoginPolicyView.js"
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
            onStatusInput={state.statusFilterSet}
            organizations={state.page.organizations()}
            pendingId={state.page.pendingId?.()}
            previousPageAvailable={state.page.previousPageAvailable()}
            search={state.search()}
            status={state.page.status()}
            statusFilter={state.statusFilter()}
            validationMessage={state.form.validationMessage.get()}
          />
        </Match>
        <Match when={state.page.screen() === "organization-detail"}>
          <OrganizationAdminDetailView
            backHref={state.listHref()}
            error={state.page.error()}
            machineCredentialsHref={state.machineCredentialsHref()}
            machinesHref={state.machinesHref()}
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
        <Match when={state.page.screen() === "login-policy"}>
          <OrganizationAdminLoginPolicyView
            error={state.page.error()}
            notice={state.page.notice()}
            onMfaLifetimeInput={state.policyLifetimeSet}
            onPasswordPolicyLockoutMinutesInput={state.passwordPolicyLockoutMinutesSet}
            onPasswordPolicyMaximumAttemptsInput={state.passwordPolicyMaximumAttemptsSet}
            onPasswordPolicyMinimumLengthInput={state.passwordPolicyMinimumLengthSet}
            onPasswordPolicySubmit={state.passwordPolicySubmit}
            onPasswordPolicyToggle={state.passwordPolicyToggle}
            onPolicySubmit={state.policySubmit}
            onPolicyToggle={state.policyToggle}
            onProviderAllowlistReset={state.policyProviderAllowlistReset}
            onProviderAllowlistToggle={state.policyProviderAllowlistToggle}
            onProviderAccountCreationToggle={state.providerAccountCreationToggle}
            onProviderCreateInput={state.providerCreateInput}
            onProviderCreateSubmit={state.providerCreateSubmit}
            onProviderCreateTypeInput={state.providerCreateTypeSet}
            onProviderDisable={state.page.providerDisable}
            onProviderEditInput={state.providerEditInput}
            onProviderEditReset={state.providerEditReset}
            onProviderEditSubmit={state.providerEditSubmit}
            onProviderEnabledToggle={state.providerEnabledToggle}
            onProviderSecretInput={state.form.providerSecretSet}
            onProviderSecretRotate={state.providerSecretRotate}
            onRetry={state.page.reload}
            onSessionLifetimeInput={state.policySessionLifetimeSet}
            overrides={state.page.overrides()}
            passwordPolicy={state.passwordPolicyDraft()}
            passwordPolicyLockoutMinutes={state.passwordPolicyLockoutMinutes()}
            passwordPolicyValidationMessage={state.passwordPolicyValidationMessage()}
            pendingId={state.page.pendingId?.()}
            policy={state.policyDraft()}
            policyScope={state.policyScope()}
            policyValidationMessage={state.policyValidationMessage()}
            providerCreate={state.form.providerCreate.get()}
            providerEdits={state.form.providerEdits.get()}
            providers={state.page.providers()}
            providerSecrets={state.form.providerSecrets.get()}
            status={state.page.status()}
            securityPolicy={state.securityPolicy}
            validationMessage={state.form.validationMessage.get()}
          />
        </Match>
      </Switch>
    </>
  )
}
