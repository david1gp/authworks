import { AccountProductionAdapter } from "./AccountProductionAdapter.js"
import { AccountAccessProductionAdapter } from "./AccountAccessProductionAdapter.js"
import { AccountOrganizationAccessProductionAdapter } from "./AccountOrganizationAccessProductionAdapter.js"
import { AccountSecurityProductionAdapter } from "./AccountSecurityProductionAdapter.js"
import { AccountWorkspaceAccess } from "./AccountWorkspaceAccess.js"
import { AccountWorkspaceDevicesApplications } from "./AccountWorkspaceDevicesApplications.js"
import { AccountWorkspace } from "./AccountWorkspace.js"
import { accountWorkspaceProductionAdapterStateCreate } from "./accountWorkspaceProductionAdapterStateCreate.js"

export function AccountWorkspaceProductionAdapter(props: { readonly realmId: string }) {
  const state = accountWorkspaceProductionAdapterStateCreate(() => props.realmId)
  return (
    <AccountWorkspace
      access={
        <AccountWorkspaceAccess>
          <AccountOrganizationAccessProductionAdapter />
          <AccountAccessProductionAdapter screen="consents" />
        </AccountWorkspaceAccess>
      }
      dangerZone={<AccountProductionAdapter kind="delete" />}
      devicesApplications={
        <AccountWorkspaceDevicesApplications
          activity={<AccountSecurityProductionAdapter realmId={props.realmId} screen="security-history" />}
          sessions={<AccountSecurityProductionAdapter realmId={props.realmId} screen="sessions" />}
          applications={<AccountSecurityProductionAdapter realmId={props.realmId} screen="refresh-tokens" />}
        />
      }
      profile={
        <>
          <AccountProductionAdapter kind="overview" securityProgress={state.securityProgress} state={state.profile} />
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
