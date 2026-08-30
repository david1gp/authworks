import { AccountProductionAdapter } from "./AccountProductionAdapter.js"
import { AccountAccessProductionAdapter } from "./AccountAccessProductionAdapter.js"
import { AccountOrganizationAccessProductionAdapter } from "./AccountOrganizationAccessProductionAdapter.js"
import { AccountSecurityProductionAdapter } from "./AccountSecurityProductionAdapter.js"
import { AccountSplitColumns } from "./AccountSplitColumns.js"
import { AccountWorkspace } from "./AccountWorkspace.js"
import { accountProductionAdapterStateCreate } from "./accountProductionAdapterStateCreate.js"

export function AccountWorkspaceProductionAdapter(props: { readonly realmId: string }) {
  const profileState = accountProductionAdapterStateCreate(() => "email", { realmId: props.realmId })
  return (
    <AccountWorkspace
      access={<AccountOrganizationAccessProductionAdapter />}
      dangerZone={<AccountProductionAdapter kind="delete" />}
      devicesApplications={
        <AccountSplitColumns
          primary={
            <>
              {/* Sessions and devices column: browser sessions first, then the long-lived refresh-token
                  families issued to those devices. Refresh tokens are session state, not applications. */}
              <AccountSecurityProductionAdapter realmId={props.realmId} screen="sessions" />
              <AccountSecurityProductionAdapter realmId={props.realmId} screen="refresh-tokens" />
            </>
          }
          secondary={<AccountAccessProductionAdapter screen="consents" />}
        />
      }
      profile={
        <>
          <AccountProductionAdapter kind="overview" state={profileState} />
          <AccountProductionAdapter kind="email" state={profileState} />
        </>
      }
      security={
        <>
          <AccountProductionAdapter kind="password" />
          <AccountSecurityProductionAdapter realmId={props.realmId} screen="passkeys" />
          <AccountSecurityProductionAdapter realmId={props.realmId} screen="factors" />
          <AccountSecurityProductionAdapter realmId={props.realmId} screen="recovery-codes" />
          <AccountSecurityProductionAdapter realmId={props.realmId} screen="identities" />
          <AccountSecurityProductionAdapter realmId={props.realmId} screen="security-history" />
        </>
      }
    />
  )
}
