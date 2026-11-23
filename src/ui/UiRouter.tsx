import { createRouter } from "@solidjs/router"
import { AccountDemoApp } from "../features/account/ui/AccountDemoApp.js"
import { AdminActivityDemoAdapter } from "../features/admin/ui/AdminActivityDemoAdapter.js"
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
import { uiRouterHistoryCreate } from "./uiRouterHistoryCreate.js"

type ProductionRouteKey = keyof typeof productionRouteContractMap

function productionRouteComponentCreate(routeKey: ProductionRouteKey) {
  const route: ProductionRouteContract = productionRouteContractMap[routeKey]
  return () => <ProductionRouteApp route={route} />
}

const Router = createRouter({
  history: uiRouterHistoryCreate(),
  routes: [
    { path: "/", component: DemoHub },
    { path: "/demo", component: DemoHub },
    { path: "/demo/login", component: LoginDemoApp },
    { path: "/demo/login/*loginPath", component: LoginDemoApp },
    { path: "/demo/account", component: AccountDemoApp },
    { path: "/demo/account/*accountPath", component: AccountDemoApp },
    { path: "/demo/invitations", component: AccountDemoApp },
    { path: "/demo/invitations/*invitationPath", component: AccountDemoApp },
    { path: "/demo/consent", component: OidcConsentDemoAdapter },
    { path: "/demo/emails", component: EmailDemoApp },
    { path: "/demo/emails/*emailPath", component: EmailDemoApp },
    {
      path: "/demo/admin",
      component: AdminDemoApp,
      children: [
        { path: "/activity", component: AdminActivityDemoAdapter },
        { path: "/sign-in", component: () => <AdminDemoAdapter screen="sign-in" /> },
        { path: "/realm", component: () => <AdminDemoAdapter screen="realm" /> },
        { path: "/realm/administrators", component: () => <DirectoryAdminDemoAdapter screen="realm-administrators" /> },
        { path: "/organizations", component: () => <OrganizationAdminDemoAdapter screen="organizations" /> },
        {
          path: "/organizations/:organizationId",
          component: () => <OrganizationAdminDemoAdapter screen="organization-detail" />,
        },
        { path: "/configuration/:section", component: OrganizationConfigurationDemoAdapter },
        { path: "/login-policy", component: () => <OrganizationAdminDemoAdapter screen="login-policy" /> },
        { path: "/users", component: () => <DirectoryAdminDemoAdapter screen="users" /> },
        { path: "/users/:userId", component: () => <DirectoryAdminDemoAdapter screen="user-detail" /> },
        { path: "/roles", component: () => <DirectoryAdminDemoAdapter screen="roles" /> },
        { path: "/impersonation", component: ImpersonationAdminDemoAdapter },
        { path: "/projects", component: () => <ProjectAdminDemoRoute screen="projects" /> },
        { path: "/projects/:projectId", component: () => <ProjectAdminDemoRoute screen="project-detail" /> },
        { path: "/oidc-clients", component: () => <OidcAdminDemoRoute screen="oidc-clients" /> },
        { path: "/oidc-clients/:clientId", component: () => <OidcAdminDemoRoute screen="oidc-client-detail" /> },
        { path: "/signing-keys", component: () => <OidcAdminDemoRoute screen="signing-keys" /> },
        { path: "/oidc-consents", component: () => <OidcAdminDemoRoute screen="oidc-consents" /> },
        { path: "/protocol-documents", component: () => <OidcAdminDemoRoute screen="protocol-documents" /> },
        {
          path: "/machine-users/:machineUserId",
          component: () => <MachineAdminDemoRoute screen="machine-user-detail" />,
        },
        { path: "/machine-credentials", component: () => <MachineAdminDemoRoute screen="machine-credentials" /> },
        { path: "/sessions", component: () => <AdminDemoAdapter screen="sessions" /> },
        { path: "/events", component: () => <AdminDemoAdapter screen="audit-events" /> },
        { path: "/whatsapp", component: () => <AdminDemoAdapter screen="whatsapp" /> },
        { path: "/ui-kit", component: AuthenticatedUiKitDemo },
        { path: "/*adminPath", component: AdminDemoPlaceholder },
      ],
    },
    { path: "/login", component: productionRouteComponentCreate("login") },
    { path: "/login/*loginPath", component: productionRouteComponentCreate("login") },
    { path: "/consent", component: productionRouteComponentCreate("consent") },
    { path: "/account", component: productionRouteComponentCreate("account") },
    { path: "/account/*accountPath", component: productionRouteComponentCreate("account") },
    { path: "/invitations", component: productionRouteComponentCreate("invitations") },
    { path: "/invitations/*invitationPath", component: productionRouteComponentCreate("invitations") },
    { path: "/orgs", component: productionRouteComponentCreate("admin") },
    { path: "/orgs/*orgPath", component: productionRouteComponentCreate("admin") },
    { path: "/realm", component: productionRouteComponentCreate("admin") },
    { path: "/realm/*realmPath", component: productionRouteComponentCreate("admin") },
    { path: "/admin", component: productionRouteComponentCreate("admin") },
    { path: "/admin/*adminPath", component: productionRouteComponentCreate("admin") },
  ],
})

export function UiRouter(props: {
  readonly api?: ProductionApiContextValue
  readonly session?: ProductionSessionContextValue
}) {
  return (
    <ProductionApplicationProviders
      api={props.api ?? productionShellContextDefault.api}
      session={props.session ?? productionShellContextDefault.session}
    >
      <Router />
    </ProductionApplicationProviders>
  )
}
