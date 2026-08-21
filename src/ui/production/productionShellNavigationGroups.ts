import type { ProductionNavigationGroup } from "./productionNavigationGroup.js"

export const productionShellNavigationGroups = {
  account: [
    {
      label: "Personal information",
      items: [
        { href: "/account", label: "Overview" },
        { href: "/account/profile", label: "Profile" },
        { href: "/account/email", label: "Email address" },
        { href: "/account/organizations", label: "Organizations" },
      ],
    },
    {
      label: "Security",
      items: [
        { href: "/account/password", label: "Password" },
        { href: "/account/sessions", label: "Sessions and devices" },
        { href: "/account/passkeys", label: "Passkeys" },
        { href: "/account/factors", label: "Multi-factor authentication" },
        { href: "/account/recovery-codes", label: "Recovery codes" },
        { href: "/account/identities", label: "Linked identities" },
      ],
    },
    {
      label: "Access",
      items: [
        { href: "/account/consents", label: "Application consents" },
        { href: "/account/delete", label: "Delete account" },
      ],
    },
  ],
  admin: [
    {
      label: "Realm",
      items: [
        { href: "/admin", label: "Overview" },
        { href: "/admin/realm", label: "Realm settings" },
        { href: "/admin/sign-in", label: "Administrator sign-in" },
        { href: "/admin/branding", label: "Branding" },
        { href: "/admin/login-policy", label: "Login and identity" },
      ],
    },
    {
      label: "Directory",
      items: [
        { href: "/admin/organizations", label: "Organizations" },
        { href: "/admin/users", label: "Users" },
        { href: "/admin/impersonation", label: "Impersonation" },
        { href: "/admin/machine-users", label: "Machine users" },
        { href: "/admin/machine-credentials", label: "Credentials and tokens" },
      ],
    },
    {
      label: "Applications",
      items: [
        { href: "/admin/projects", label: "Projects" },
        { href: "/admin/applications", label: "Applications" },
        { href: "/admin/roles-grants", label: "Roles and grants" },
      ],
    },
    {
      label: "OpenID Connect",
      items: [
        { href: "/admin/oidc-clients", label: "OIDC clients" },
        { href: "/admin/signing-keys", label: "Signing keys" },
        { href: "/admin/oidc-consents", label: "Application consents" },
        { href: "/admin/protocol-documents", label: "Protocol documents" },
      ],
    },
    {
      label: "Operations",
      items: [
        { href: "/admin/sessions", label: "Sessions" },
        { href: "/admin/events", label: "Audit events" },
      ],
    },
  ],
  invitations: [
    {
      label: "Account",
      items: [
        { href: "/account", label: "Overview" },
        { href: "/account/organizations", label: "Organizations" },
        { href: "/invitations", label: "Invitations" },
      ],
    },
  ],
} as const satisfies Readonly<Record<"account" | "admin" | "invitations", readonly ProductionNavigationGroup[]>>
