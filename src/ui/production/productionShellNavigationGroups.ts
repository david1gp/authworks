import type { ProductionNavigationGroup } from "./productionNavigationGroup.js"

export const productionShellNavigationGroups = {
  account: [
    {
      label: "shell.nav.personalInformation",
      items: [
        { href: "/account", label: "shell.nav.overview" },
        { href: "/account/profile", label: "shell.nav.profile" },
        { href: "/account/email", label: "shell.nav.emailAddress" },
        { href: "/account/organizations", label: "shell.nav.organizations" },
      ],
    },
    {
      label: "shell.nav.security",
      items: [
        { href: "/account/password", label: "shell.nav.password" },
        { href: "/account/sessions", label: "shell.nav.sessionsDevices" },
        { href: "/account/passkeys", label: "shell.nav.passkeys" },
        { href: "/account/factors", label: "shell.nav.mfa" },
        { href: "/account/recovery-codes", label: "shell.nav.recoveryCodes" },
        { href: "/account/identities", label: "shell.nav.linkedIdentities" },
      ],
    },
    {
      label: "shell.nav.access",
      items: [
        { href: "/account/consents", label: "shell.nav.applicationConsents" },
        { href: "/account/delete", label: "shell.nav.deleteAccount" },
      ],
    },
  ],
  admin: [
    {
      label: "shell.nav.realm",
      items: [
        { href: "/admin", label: "shell.nav.overview" },
        { href: "/admin/realm", label: "shell.nav.realmSettings" },
        { href: "/admin/sign-in", label: "shell.nav.administratorSignIn" },
        { href: "/admin/branding", label: "shell.nav.branding" },
        { href: "/admin/login-policy", label: "shell.nav.loginPolicy" },
      ],
    },
    {
      label: "shell.nav.directory",
      items: [
        { href: "/admin/organizations", label: "shell.nav.organizations" },
        { href: "/admin/users", label: "shell.nav.users" },
        { href: "/admin/impersonation", label: "shell.nav.impersonation" },
        { href: "/admin/machine-users", label: "shell.nav.machineUsers" },
        { href: "/admin/machine-credentials", label: "shell.nav.credentialsTokens" },
      ],
    },
    {
      label: "shell.nav.applications",
      items: [{ href: "/admin/projects", label: "shell.nav.projects" }],
    },
    {
      label: "shell.nav.openIdConnect",
      items: [
        { href: "/admin/oidc-clients", label: "shell.nav.oidcClients" },
        { href: "/admin/signing-keys", label: "shell.nav.signingKeys" },
        { href: "/admin/oidc-consents", label: "shell.nav.applicationConsents" },
        { href: "/admin/protocol-documents", label: "shell.nav.protocolDocuments" },
      ],
    },
    {
      label: "shell.nav.operations",
      items: [
        { href: "/admin/sessions", label: "shell.nav.sessions" },
        { href: "/admin/events", label: "shell.nav.auditEvents" },
      ],
    },
  ],
  invitations: [
    {
      label: "shell.nav.account",
      items: [
        { href: "/account", label: "shell.nav.overview" },
        { href: "/account/organizations", label: "shell.nav.organizations" },
        { href: "/invitations", label: "shell.nav.invitations" },
      ],
    },
  ],
} as const satisfies Readonly<Record<"account" | "admin" | "invitations", readonly ProductionNavigationGroup[]>>
