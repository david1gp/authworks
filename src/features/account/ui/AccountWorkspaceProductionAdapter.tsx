import { AccountProductionAdapter } from "./AccountProductionAdapter.js"
import { AccountAccessProductionAdapter } from "./AccountAccessProductionAdapter.js"
import { AccountOrganizationAccessProductionAdapter } from "./AccountOrganizationAccessProductionAdapter.js"
import { AccountSecurityProductionAdapter } from "./AccountSecurityProductionAdapter.js"
import { AccountWorkspace } from "./AccountWorkspace.js"
import { accountProductionAdapterStateCreate } from "./accountProductionAdapterStateCreate.js"

export function AccountWorkspaceProductionAdapter(props: { readonly realmId: string }) {
  const profileState = accountProductionAdapterStateCreate(() => "email", { realmId: props.realmId })
  return (
    <AccountWorkspace
      access={<AccountOrganizationAccessProductionAdapter />}
      dangerZone={<AccountProductionAdapter kind="delete" />}
      devicesApplications={
        <div class="grid min-w-0 items-start gap-3 lg:grid-cols-12 [&>*]:min-w-0">
          <div class="lg:col-span-12">
            <AccountSecurityProductionAdapter realmId={props.realmId} screen="security-history" />
          </div>
          <div class="grid min-w-0 gap-3 lg:col-span-7 [&>*]:min-w-0">
            <AccountSecurityProductionAdapter realmId={props.realmId} screen="sessions" />
            <AccountSecurityProductionAdapter realmId={props.realmId} screen="refresh-tokens" />
          </div>
          <div class="min-w-0 lg:col-span-5">
            <AccountAccessProductionAdapter screen="consents" />
          </div>
        </div>
      }
      profile={
        <>
          <AccountProductionAdapter kind="overview" state={profileState} />
          <AccountProductionAdapter kind="email" state={profileState} />
        </>
      }
      security={
        <AccountSecurityProductionAdapter
          passwordAction={<AccountProductionAdapter kind="password" passwordActionOnly />}
          realmId={props.realmId}
          screen="overview"
        />
      }
    />
  )
}
