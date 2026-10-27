import { AccountAccessDemoAdapter } from "./AccountAccessDemoAdapter.js"
import { AccountDemoAdapter } from "./AccountDemoAdapter.js"
import { AccountExportCard } from "./AccountExportCard.js"
import { AccountSecurityDemoAdapter } from "./AccountSecurityDemoAdapter.js"
import { AccountWorkspace } from "./AccountWorkspace.js"
import { AccountWorkspaceAccess } from "./AccountWorkspaceAccess.js"
import { AccountWorkspaceDevicesApplications } from "./AccountWorkspaceDevicesApplications.js"
import { AccountWorkspaceToolbar } from "./AccountWorkspaceToolbar.js"
import { accountWorkspaceDemoAdapterStateCreate } from "./accountWorkspaceDemoAdapterStateCreate.js"

export function AccountWorkspaceDemoAdapter() {
  const state = accountWorkspaceDemoAdapterStateCreate()
  const userLabel = () => {
    const user = state.profile.page.user.get()
    return user?.profile.displayName || user?.email || user?.userName || ""
  }
  return (
    <AccountWorkspace
      profileActions={<AccountWorkspaceToolbar userLabel={userLabel()} />}
      access={
        <AccountWorkspaceAccess>
          <AccountAccessDemoAdapter screen="organizations" showFixtureHeader={false} />
          <AccountAccessDemoAdapter screen="consents" showFixtureHeader={false} />
        </AccountWorkspaceAccess>
      }
      dangerZone={
        <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
          <AccountExportCard
            exportErrorMessage={state.profile.page.exportError.get()}
            exportPending={state.profile.page.exportPending.get()}
            onExportDownload={() => void state.profile.page.exportDownload()}
          />
          <AccountDemoAdapter kind="delete" path="/demo/account" showFixtureHeader={false} />
        </div>
      }
      devicesApplications={
        <AccountWorkspaceDevicesApplications
          activity={<AccountSecurityDemoAdapter screen="security-history" showFixtureHeader={false} />}
          sessions={<AccountSecurityDemoAdapter screen="sessions" showFixtureHeader={false} />}
          applications={<AccountSecurityDemoAdapter screen="refresh-tokens" showFixtureHeader={false} />}
        />
      }
      profile={
        <AccountDemoAdapter
          kind="overview"
          path="/demo/account"
          securityProgress={state.securityProgress}
          showFixtureHeader={false}
          state={state.profile}
        />
      }
      security={
        <AccountSecurityDemoAdapter
          passwordAction={
            <AccountDemoAdapter
              hasPassword={() => state.security.methods().password.available}
              kind="password"
              onPasswordChanged={() => state.security.reload()}
              passwordActionOnly
              path="/demo/account"
              showFixtureHeader={false}
            />
          }
          screen="overview"
          showFixtureHeader={false}
          state={state.security}
        />
      }
    />
  )
}
