import { AccountAccessProductionAdapter } from "./AccountAccessProductionAdapter.js"
import { AccountProductionAdapter } from "./AccountProductionAdapter.js"
import { AccountSecurityProductionAdapter } from "./AccountSecurityProductionAdapter.js"
import { AccountWorkspace } from "./AccountWorkspace.js"
import { accountProductionAdapterStateCreate } from "./accountProductionAdapterStateCreate.js"

export function AccountWorkspaceProductionAdapter(props: { readonly realmId: string }) {
  const profileState = accountProductionAdapterStateCreate(() => "email")
  return (
    <AccountWorkspace
      access={
        <>
          <AccountAccessProductionAdapter screen="organizations" />
          <AccountAccessProductionAdapter screen="effective-access" />
        </>
      }
      dangerZone={<AccountProductionAdapter kind="delete" />}
      devicesApplications={
        <>
          <AccountSecurityProductionAdapter realmId={props.realmId} screen="sessions" />
          <AccountSecurityProductionAdapter realmId={props.realmId} screen="refresh-tokens" />
          <AccountAccessProductionAdapter screen="consents" />
        </>
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
