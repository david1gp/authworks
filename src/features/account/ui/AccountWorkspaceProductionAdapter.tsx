import { AccountAccessProductionAdapter } from "./AccountAccessProductionAdapter.js"
import { AccountExportCard } from "./AccountExportCard.js"
import { AccountOrganizationAccessProductionAdapter } from "./AccountOrganizationAccessProductionAdapter.js"
import { AccountProductionAdapter } from "./AccountProductionAdapter.js"
import { AccountSecurityProductionAdapter } from "./AccountSecurityProductionAdapter.js"
import { AccountWorkspace } from "./AccountWorkspace.js"
import { AccountWorkspaceAccess } from "./AccountWorkspaceAccess.js"
import { AccountWorkspaceDevicesApplications } from "./AccountWorkspaceDevicesApplications.js"
import { AccountWorkspaceToolbar } from "./AccountWorkspaceToolbar.js"
import { accountWorkspaceProductionAdapterStateCreate } from "./accountWorkspaceProductionAdapterStateCreate.js"

export function AccountWorkspaceProductionAdapter(props: { readonly realmId: string }) {
  const state = accountWorkspaceProductionAdapterStateCreate(() => props.realmId)
  return (
    <AccountWorkspace
      profileActions={
        <AccountWorkspaceToolbar administrationHref={state.administrationHref()} userLabel={state.userLabel()} />
      }
      access={
        <AccountWorkspaceAccess>
          <AccountOrganizationAccessProductionAdapter />
          <AccountAccessProductionAdapter screen="consents" />
        </AccountWorkspaceAccess>
      }
      dangerZone={
        <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
          <AccountExportCard
            exportErrorMessage={state.profile.exportError.get()}
            exportPending={state.profile.exportPending.get()}
            onExportDownload={() => void state.profile.exportDownload()}
          />
          <AccountProductionAdapter kind="delete" />
        </div>
      }
      devicesApplications={
        <AccountWorkspaceDevicesApplications
          activity={<AccountSecurityProductionAdapter realmId={props.realmId} screen="security-history" />}
          sessions={<AccountSecurityProductionAdapter realmId={props.realmId} screen="sessions" />}
          applications={<AccountSecurityProductionAdapter realmId={props.realmId} screen="refresh-tokens" />}
        />
      }
      profile={
        <AccountProductionAdapter kind="overview" securityProgress={state.securityProgress} state={state.profile} />
      }
      security={
        <AccountSecurityProductionAdapter
          passwordAction={
            <AccountProductionAdapter
              hasPassword={() => state.security.methods().password.available}
              kind="password"
              onPasswordChanged={() => state.security.reload()}
              passwordActionOnly
            />
          }
          realmId={props.realmId}
          screen="overview"
          state={state.security}
        />
      }
    />
  )
}
