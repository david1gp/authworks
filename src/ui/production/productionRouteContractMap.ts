import type { ProductionRouteContract } from "./productionRouteContract.js"
import type { ProductionRouteAccess } from "./productionRouteGuardRequirement.js"

type AdminOrganizationGuard = {
  readonly access: ProductionRouteAccess
  readonly authentication: "required"
  readonly organization: "required"
  readonly permission: null
  readonly realm: "required"
}

type AdminNoOrgGuard = {
  readonly access: ProductionRouteAccess
  readonly authentication: "required"
  readonly organization: "not-required"
  readonly permission: null
  readonly realm: "required"
}

const organizationAdminGuard: AdminOrganizationGuard = {
  access: "organization-admin",
  authentication: "required",
  organization: "required",
  permission: null,
  realm: "required",
}

const realmAdminGuard: AdminNoOrgGuard = {
  access: "realm-admin",
  authentication: "required",
  organization: "not-required",
  permission: null,
  realm: "required",
}

const realmAdminOrganizationGuard: AdminOrganizationGuard = {
  access: "realm-admin",
  authentication: "required",
  organization: "required",
  permission: null,
  realm: "required",
}

export const productionRouteContractMap = {
  login: {
    feature: "login",
    guard: { authentication: "public", organization: "not-required", permission: null, realm: "required" },
    path: "/login",
    screens: [
      {
        contracts: ["organizations.discovery", "organizations.login-policy", "sessions.recent"],
        key: "chooser",
        path: "/login",
        title: "login.chooser.title",
      },
      { contracts: ["passwords.login"], key: "password", path: "/login/password", title: "shell.nav.passwordSignIn" },
      {
        contracts: ["email-otp.start", "email-otp.verify"],
        key: "email-otp",
        path: "/login/email-otp",
        title: "shell.nav.emailOtpSignIn",
      },
      {
        contracts: ["whatsapp-otp.availability", "whatsapp-otp.start"],
        key: "whatsapp-otp",
        path: "/login/whatsapp-otp",
        title: "login.whatsappOtp.title",
      },
      {
        contracts: ["whatsapp-otp.resend", "whatsapp-otp.verify"],
        key: "whatsapp-otp-code",
        path: "/login/whatsapp-otp/code",
        title: "login.whatsappOtp.codeTitle",
      },
      {
        contracts: ["passkeys.authenticate"],
        key: "passkey",
        path: "/login/passkey",
        title: "shell.nav.passkeySignIn",
      },
      {
        contracts: ["external-identities.authenticate"],
        key: "external-identity",
        path: "/login/idp",
        title: "shell.nav.externalIdentitySignIn",
      },
      { contracts: ["mfa.challenge"], key: "mfa", path: "/login/mfa", title: "shell.nav.mfaSignIn" },
      {
        contracts: ["passwords.recovery.request", "passwords.recovery.complete"],
        key: "recovery",
        path: "/login/password/forgot",
        title: "shell.nav.passwordRecovery",
      },
      { contracts: ["passwords.register"], key: "register", path: "/login/register", title: "shell.nav.registration" },
      {
        contracts: ["passwords.verify-email"],
        key: "verify-email",
        path: "/login/verify-email",
        title: "shell.nav.verifyEmail",
      },
      {
        contracts: ["oidc.interaction"],
        key: "consent",
        path: "/login/consent",
        title: "shell.nav.applicationConsent",
      },
      { contracts: ["oidc.logout"], key: "logout", path: "/login/logout", title: "shell.nav.logout" },
    ],
  },
  consent: {
    feature: "oidc",
    guard: { authentication: "required", organization: "optional", permission: null, realm: "required" },
    path: "/consent",
    screens: [
      {
        contracts: ["oidc.authorization", "oidc.consent"],
        key: "consent",
        path: "/consent",
        title: "shell.nav.applicationConsent",
      },
    ],
  },
  account: {
    feature: "account",
    guard: { authentication: "required", organization: "optional", permission: null, realm: "required" },
    path: "/account",
    screens: [
      {
        contracts: [
          "account.overview",
          "account.profile",
          "account.email",
          "account.password",
          "account.delete",
          "organizations.list",
          "organizations.switch",
          "account.effective-access",
          "sessions.list",
          "sessions.revoke",
          "passkeys.list",
          "passkeys.revoke",
          "mfa.list",
          "mfa.enroll",
          "mfa.revoke",
          "mfa.recovery-codes",
          "external-identities.list",
          "external-identities.providers",
          "external-identities.link-start",
          "external-identities.link-callback",
          "external-identities.link-complete",
          "external-identities.unlink",
          "oidc.refresh-tokens.list",
          "oidc.refresh-tokens.revoke",
          "account.security-history",
          "oidc.consents.list",
          "oidc.consents.revoke",
        ],
        key: "overview",
        path: "/account",
        title: "shell.nav.account",
      },
    ],
  },
  invitations: {
    feature: "organizations",
    guard: { authentication: "required", organization: "optional", permission: null, realm: "required" },
    path: "/invitations",
    screens: [
      {
        contracts: ["organizations.invitations.accept", "organizations.invitations.decline"],
        key: "overview",
        path: "/invitations",
        title: "shell.nav.invitations",
      },
      {
        contracts: ["organizations.invitations.accept", "organizations.invitations.decline"],
        key: "accept",
        path: "/invitations/accept",
        title: "shell.nav.acceptInvitation",
      },
    ],
  },
  admin: {
    feature: "admin",
    guard: {
      access: "organization-admin",
      authentication: "required",
      organization: "not-required",
      permission: null,
      realm: "required",
    },
    path: "/admin/users",
    screens: [
      {
        contracts: ["events.list", "organizations.activity.list"],
        guard: { ...organizationAdminGuard, organization: "optional" },
        key: "activity",
        ownsPageHeader: true,
        path: "/admin/activity",
        title: "shell.nav.activity",
      },
      {
        contracts: ["users.list", "users.create"],
        guard: { ...organizationAdminGuard, organization: "not-required" },
        key: "users",
        ownsPageHeader: true,
        path: "/admin/users",
        title: "shell.nav.users",
      },
      {
        contracts: ["users.get", "users.profile"],
        guard: { ...organizationAdminGuard, organization: "not-required" },
        key: "user-detail",
        path: "/admin/users/:userId",
        title: "admin.users.detailTitle",
      },
      {
        contracts: ["organizations.memberships.list", "authorization.roles.list"],
        guard: { ...organizationAdminGuard, organization: "not-required" },
        key: "roles",
        path: "/admin/roles",
        title: "shell.nav.roles",
      },
      {
        contracts: ["realms.administrators.list"],
        guard: { ...realmAdminGuard },
        key: "realm-administrators",
        ownsPageHeader: true,
        path: "/admin/realm/administrators",
        title: "shell.nav.realmAdministrators",
      },
      {
        contracts: ["projects.list", "projects.create"],
        guard: { ...organizationAdminGuard, organization: "not-required" },
        key: "projects",
        ownsPageHeader: true,
        path: "/admin/projects",
        title: "shell.nav.projects",
      },
      {
        contracts: ["projects.get", "projects.update", "projects.delete"],
        guard: { ...organizationAdminGuard, organization: "not-required" },
        key: "project-detail",
        path: "/admin/projects/:projectId",
        title: "admin.projects.detailTitle",
      },
      {
        contracts: ["organizations.branding.get", "organizations.login-policy.get"],
        guard: { ...organizationAdminGuard, organization: "required" },
        key: "configuration",
        ownsPageHeader: true,
        path: "/admin/configuration/:section",
        title: "shell.nav.configuration",
      },
      {
        contracts: ["realms.get", "realms.update"],
        guard: { ...realmAdminGuard },
        key: "realm",
        ownsPageHeader: true,
        path: "/admin/realm",
        title: "shell.nav.realmOverviewSettings",
      },
      {
        contracts: ["organizations.login-policy.get", "organizations.login-policy.set"],
        guard: { ...realmAdminGuard },
        key: "login-policy",
        path: "/admin/login-policy",
        title: "shell.nav.loginPolicy",
      },
      {
        contracts: ["organizations.list", "organizations.create"],
        guard: { ...realmAdminGuard },
        key: "organizations",
        path: "/admin/organizations",
        title: "shell.nav.organizations",
      },
      {
        contracts: ["organizations.get", "organizations.update"],
        guard: { ...realmAdminOrganizationGuard },
        key: "organization-detail",
        path: "/admin/organizations/:organizationId",
        title: "admin.organizations.detailTitle",
      },
      {
        contracts: ["sessions.admin-sign-in"],
        guard: { authentication: "public", organization: "not-required", permission: null, realm: "required" },
        key: "sign-in",
        path: "/admin/sign-in",
        title: "shell.nav.administratorSignIn",
      },
      {
        contracts: ["oidc.clients.list", "oidc.clients.create", "oidc.clients.update"],
        guard: { ...realmAdminGuard },
        key: "oidc-clients",
        path: "/admin/oidc-clients",
        title: "shell.nav.oidcClients",
      },
      {
        contracts: ["oidc.clients.get", "oidc.clients.update", "oidc.clients.secret"],
        guard: { ...realmAdminGuard },
        key: "oidc-client-detail",
        path: "/admin/oidc-clients/:clientId",
        title: "admin.oidc.clients.detailTitle",
      },
      {
        contracts: ["oidc.signing-keys.list", "oidc.signing-keys.rotate"],
        guard: { ...realmAdminGuard },
        key: "signing-keys",
        path: "/admin/signing-keys",
        title: "shell.nav.signingKeys",
      },
      {
        contracts: ["oidc.consents.list", "oidc.consents.revoke"],
        guard: { ...realmAdminGuard },
        key: "oidc-consents",
        path: "/admin/oidc-consents",
        title: "shell.nav.applicationConsents",
      },
      {
        contracts: ["oidc.discovery", "oidc.jwks"],
        guard: { ...realmAdminGuard },
        key: "protocol-documents",
        path: "/admin/protocol-documents",
        title: "shell.nav.protocolDocuments",
      },
      {
        contracts: ["machine-users.get", "machine-users.lifecycle", "machine-users.credentials.rotate"],
        guard: { ...organizationAdminGuard },
        key: "machine-user-detail",
        path: "/admin/machine-users/:machineUserId",
        title: "admin.machine.users.detailTitle",
      },
      {
        contracts: [
          "machine-users.credentials.issue",
          "machine-users.credentials.rotate",
          "machine-users.credentials.revoke",
        ],
        guard: { ...organizationAdminGuard },
        key: "machine-credentials",
        path: "/admin/machine-credentials",
        title: "shell.nav.machineCredentials",
      },
      {
        contracts: ["impersonation.start", "impersonation.end"],
        guard: { ...organizationAdminGuard, organization: "not-required" },
        key: "impersonation",
        path: "/admin/impersonation",
        title: "shell.nav.impersonation",
      },
      {
        contracts: ["sessions.list", "sessions.revoke"],
        guard: { ...realmAdminGuard },
        key: "sessions",
        path: "/admin/sessions",
        title: "shell.nav.sessions",
      },
      {
        contracts: ["events.list"],
        guard: { ...realmAdminGuard },
        key: "audit-events",
        path: "/admin/events",
        title: "shell.nav.auditEvents",
      },
    ],
  },
} as const satisfies Readonly<Record<string, ProductionRouteContract>>
