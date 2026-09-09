import { AccountProductionAdapter } from "./AccountProductionAdapter.js"
import { AccountAccessProductionAdapter } from "./AccountAccessProductionAdapter.js"
import { AccountOrganizationAccessProductionAdapter } from "./AccountOrganizationAccessProductionAdapter.js"
import { AccountSecurityProductionAdapter } from "./AccountSecurityProductionAdapter.js"
import { AccountWorkspace } from "./AccountWorkspace.js"
import { accountWorkspaceProductionAdapterStateCreate } from "./accountWorkspaceProductionAdapterStateCreate.js"

export function AccountWorkspaceProductionAdapter(props: { readonly realmId: string }) {
  const state = accountWorkspaceProductionAdapterStateCreate(() => props.realmId)
  return (
    <AccountWorkspace
      access={
        <div class="grid min-w-0 gap-5 [&>*]:min-w-0">
          <AccountOrganizationAccessProductionAdapter />
          <AccountAccessProductionAdapter screen="consents" />
        </div>
      }
      dangerZone={<AccountProductionAdapter kind="delete" />}
      devicesApplications={
        <div class="grid min-w-0 items-start gap-3 lg:grid-cols-2 [&>*]:min-w-0">
          <div class="lg:col-span-2">
            <AccountSecurityProductionAdapter realmId={props.realmId} screen="security-history" />
          </div>
          <div class="min-w-0">
            <AccountSecurityProductionAdapter realmId={props.realmId} screen="sessions" />
          </div>
          <div class="min-w-0">
            <AccountSecurityProductionAdapter realmId={props.realmId} screen="refresh-tokens" />
          </div>
        </div>
      }
      profile={
        <>
          <AccountProductionAdapter
            configuredSecurityMethodCount={state.securityProgress.configuredCount()}
            kind="overview"
            state={state.profile}
          />
          <AccountProductionAdapter kind="email" renderConfirmation={false} state={state.profile} />
        </>
      }
      security={
        <AccountSecurityProductionAdapter
          passwordAction={<AccountProductionAdapter kind="password" passwordActionOnly />}
          realmId={props.realmId}
          screen="overview"
          state={state.security}
        />
      }
    />
  )
}
