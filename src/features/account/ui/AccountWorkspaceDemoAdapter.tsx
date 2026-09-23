import { AccountAccessDemoAdapter } from "./AccountAccessDemoAdapter.js"
import { AccountDemoAdapter } from "./AccountDemoAdapter.js"
import { AccountSecurityDemoAdapter } from "./AccountSecurityDemoAdapter.js"
import { AccountWorkspace } from "./AccountWorkspace.js"
import { AccountWorkspaceAccess } from "./AccountWorkspaceAccess.js"
import { AccountWorkspaceDevicesApplications } from "./AccountWorkspaceDevicesApplications.js"
import { accountWorkspaceDemoAdapterStateCreate } from "./accountWorkspaceDemoAdapterStateCreate.js"

export function AccountWorkspaceDemoAdapter() {
  const state = accountWorkspaceDemoAdapterStateCreate()
  return (
    <AccountWorkspace
      access={
        <AccountWorkspaceAccess>
          <AccountAccessDemoAdapter screen="organizations" showFixtureHeader={false} />
          <AccountAccessDemoAdapter screen="consents" showFixtureHeader={false} />
        </AccountWorkspaceAccess>
      }
      dangerZone={<AccountDemoAdapter kind="delete" path="/demo/account" showFixtureHeader={false} />}
      devicesApplications={
        <AccountWorkspaceDevicesApplications
          activity={<AccountSecurityDemoAdapter screen="security-history" showFixtureHeader={false} />}
          sessions={<AccountSecurityDemoAdapter screen="sessions" showFixtureHeader={false} />}
          applications={<AccountSecurityDemoAdapter screen="refresh-tokens" showFixtureHeader={false} />}
        />
      }
      profile={
        <>
          <AccountDemoAdapter
            kind="overview"
            path="/demo/account"
            securityProgress={state.securityProgress}
            showFixtureHeader={false}
            state={state.profile}
          />
          <AccountDemoAdapter
            kind="email"
            path="/demo/account"
            renderConfirmation={false}
            showFixtureHeader={false}
            state={state.profile}
          />
        </>
      }
      security={
        <AccountSecurityDemoAdapter
          passwordAction={
            <AccountDemoAdapter kind="password" passwordActionOnly path="/demo/account" showFixtureHeader={false} />
          }
          screen="overview"
          showFixtureHeader={false}
          state={state.security}
        />
      }
    />
  )
}
