import { Route, Router } from "@solidjs/router"
import { AccountDemoApp } from "../features/account/ui/AccountDemoApp.js"
import { AdminDemoAdapter } from "../features/admin/ui/AdminDemoAdapter.js"
import { AdminDemoApp } from "../features/admin/ui/AdminDemoApp.js"
import { AdminDemoPlaceholder } from "../features/admin/ui/AdminDemoPlaceholder.js"
import { DemoHub } from "../features/demo/ui/DemoHub.js"
import { DirectoryAdminDemoAdapter } from "../features/directory/ui/DirectoryAdminDemoAdapter.js"
import { EmailDemoApp } from "../features/email/ui/EmailDemoApp.js"
import { ImpersonationAdminDemoAdapter } from "../features/impersonation/ui/ImpersonationAdminDemoAdapter.js"
import { LoginDemoApp } from "../features/login/ui/LoginDemoApp.js"
import { MachineAdminDemoRoute } from "../features/machineUsers/ui/MachineAdminDemoRoute.js"
import { OidcAdminDemoRoute } from "../features/oidc/ui/OidcAdminDemoRoute.js"
import { OidcConsentDemoAdapter } from "../features/oidc/ui/OidcConsentDemoAdapter.js"
import { OrganizationAdminDemoAdapter } from "../features/organizations/ui/OrganizationAdminDemoAdapter.js"
import { OrganizationConfigurationDemoAdapter } from "../features/organizations/ui/OrganizationConfigurationDemoAdapter.js"
import { ProjectAdminDemoRoute } from "../features/projects/ui/ProjectAdminDemoRoute.js"
import { AuthenticatedUiKitDemo } from "./authenticated/demo/AuthenticatedUiKitDemo.js"
import { ProductionApplicationProviders } from "./production/ProductionApplicationProviders.js"
import { ProductionRouteApp } from "./production/ProductionRouteApp.js"
import type { ProductionApiContextValue } from "./production/productionApiContextValue.js"
import type { ProductionRouteContract } from "./production/productionRouteContract.js"
import { productionRouteContractMap } from "./production/productionRouteContractMap.js"
import type { ProductionSessionContextValue } from "./production/productionSessionContextValue.js"
import { productionShellContextDefault } from "./production/productionShellContextDefault.js"

type ProductionRouteKey = keyof typeof productionRouteContractMap

function productionRouteComponentCreate(routeKey: ProductionRouteKey) {
  const route: ProductionRouteContract = productionRouteContractMap[routeKey]
  return () => <ProductionRouteApp route={route} />
}

export function UiRouter(props: {
  readonly api?: ProductionApiContextValue
  readonly session?: ProductionSessionContextValue
}) {
  return (
    <ProductionApplicationProviders
      api={props.api ?? productionShellContextDefault.api}
      session={props.session ?? productionShellContextDefault.session}
    >
      <Router>
        <Route path="/" component={DemoHub} />
        <Route path="/demo" component={DemoHub} />
        <Route path="/demo/login" component={LoginDemoApp} />
        <Route path="/demo/login/*loginPath" component={LoginDemoApp} />
        <Route path="/demo/account" component={AccountDemoApp} />
        <Route path="/demo/account/*accountPath" component={AccountDemoApp} />
        <Route path="/demo/invitations" component={AccountDemoApp} />
        <Route path="/demo/invitations/*invitationPath" component={AccountDemoApp} />
        <Route path="/demo/consent" component={OidcConsentDemoAdapter} />
        <Route path="/demo/emails" component={EmailDemoApp} />
        <Route path="/demo/emails/*emailPath" component={EmailDemoApp} />
        <Route path="/demo/admin" component={AdminDemoApp}>
          <Route path="/sign-in" component={() => <AdminDemoAdapter screen="sign-in" />} />
          <Route path="/realm" component={() => <AdminDemoAdapter screen="realm" />} />
          <Route
            path="/realm/administrators"
            component={() => <DirectoryAdminDemoAdapter screen="realm-administrators" />}
          />
          <Route path="/organizations" component={() => <OrganizationAdminDemoAdapter screen="organizations" />} />
          <Route
            path="/organizations/:organizationId"
            component={() => <OrganizationAdminDemoAdapter screen="organization-detail" />}
          />
          <Route path="/configuration/:section" component={OrganizationConfigurationDemoAdapter} />
          <Route path="/login-policy" component={() => <OrganizationAdminDemoAdapter screen="login-policy" />} />
          <Route path="/users" component={() => <DirectoryAdminDemoAdapter screen="users" />} />
          <Route path="/users/:userId" component={() => <DirectoryAdminDemoAdapter screen="user-detail" />} />
          <Route path="/roles" component={() => <DirectoryAdminDemoAdapter screen="roles" />} />
          <Route path="/impersonation" component={ImpersonationAdminDemoAdapter} />
          <Route path="/projects" component={() => <ProjectAdminDemoRoute screen="projects" />} />
          <Route path="/projects/:projectId" component={() => <ProjectAdminDemoRoute screen="project-detail" />} />
          <Route path="/oidc-clients" component={() => <OidcAdminDemoRoute screen="oidc-clients" />} />
          <Route path="/oidc-clients/:clientId" component={() => <OidcAdminDemoRoute screen="oidc-client-detail" />} />
          <Route path="/signing-keys" component={() => <OidcAdminDemoRoute screen="signing-keys" />} />
          <Route path="/oidc-consents" component={() => <OidcAdminDemoRoute screen="oidc-consents" />} />
          <Route path="/protocol-documents" component={() => <OidcAdminDemoRoute screen="protocol-documents" />} />
          <Route
            path="/machine-users/:machineUserId"
            component={() => <MachineAdminDemoRoute screen="machine-user-detail" />}
          />
          <Route path="/machine-credentials" component={() => <MachineAdminDemoRoute screen="machine-credentials" />} />
          <Route path="/sessions" component={() => <AdminDemoAdapter screen="sessions" />} />
          <Route path="/events" component={() => <AdminDemoAdapter screen="audit-events" />} />
          <Route path="/ui-kit" component={AuthenticatedUiKitDemo} />
          <Route path="/*adminPath" component={AdminDemoPlaceholder} />
        </Route>
        <Route path="/login" component={productionRouteComponentCreate("login")} />
        <Route path="/login/*loginPath" component={productionRouteComponentCreate("login")} />
        <Route path="/consent" component={productionRouteComponentCreate("consent")} />
        <Route path="/account" component={productionRouteComponentCreate("account")} />
        <Route path="/account/*accountPath" component={productionRouteComponentCreate("account")} />
        <Route path="/invitations" component={productionRouteComponentCreate("invitations")} />
        <Route path="/invitations/*invitationPath" component={productionRouteComponentCreate("invitations")} />
        <Route path="/admin" component={productionRouteComponentCreate("admin")} />
        <Route path="/admin/*adminPath" component={productionRouteComponentCreate("admin")} />
      </Router>
    </ProductionApplicationProviders>
  )
}
