import { mdiAccountMultipleOutline } from "@adaptive-ds/mdi/mdiAccountMultipleOutline.js"
import { mdiAccountStarOutline } from "@adaptive-ds/mdi/mdiAccountStarOutline.js"
import { mdiAccountSwitchOutline } from "@adaptive-ds/mdi/mdiAccountSwitchOutline.js"
import { mdiApplicationOutline } from "@adaptive-ds/mdi/mdiApplicationOutline.js"
import { mdiCheckDecagramOutline } from "@adaptive-ds/mdi/mdiCheckDecagramOutline.js"
import { mdiClipboardTextOutline } from "@adaptive-ds/mdi/mdiClipboardTextOutline.js"
import { mdiCogOutline } from "@adaptive-ds/mdi/mdiCogOutline.js"
import { mdiFileDocumentOutline } from "@adaptive-ds/mdi/mdiFileDocumentOutline.js"
import { mdiKeyChain } from "@adaptive-ds/mdi/mdiKeyChain.js"
import { mdiLogin } from "@adaptive-ds/mdi/mdiLogin.js"
import { mdiMonitorCellphone } from "@adaptive-ds/mdi/mdiMonitorCellphone.js"
import { mdiOfficeBuildingOutline } from "@adaptive-ds/mdi/mdiOfficeBuildingOutline.js"
import { mdiOpenid } from "@adaptive-ds/mdi/mdiOpenid.js"
import { mdiRobotOutline } from "@adaptive-ds/mdi/mdiRobotOutline.js"
import { mdiShieldCrownOutline } from "@adaptive-ds/mdi/mdiShieldCrownOutline.js"
import { mdiTuneVariant } from "@adaptive-ds/mdi/mdiTuneVariant.js"
import type { ProductionNavigationGroup } from "./productionNavigationGroup.js"

/**
 * Production administration navigation: the sidebar shows one context at a time.
 * Organization items render when an organization is selected, realm items render
 * when the realm is selected in the administration context switcher (realm
 * administrators only). There is no collapsible Realm group.
 */
export const productionShellNavigationGroups = {
  account: [],
  admin: [
    {
      label: null,
      scope: "organization",
      items: [
        {
          access: "organization-admin",
          href: "/admin/users",
          icon: mdiAccountMultipleOutline,
          label: "shell.nav.users",
        },
        { access: "organization-admin", href: "/admin/roles", icon: mdiAccountStarOutline, label: "shell.nav.roles" },
        {
          access: "organization-admin",
          href: "/admin/projects",
          icon: mdiApplicationOutline,
          label: "shell.nav.projects",
        },
        {
          access: "organization-admin",
          href: "/admin/machine-credentials",
          icon: mdiRobotOutline,
          label: "shell.nav.machineCredentials",
        },
        {
          access: "organization-admin",
          href: "/admin/impersonation",
          icon: mdiAccountSwitchOutline,
          label: "shell.nav.impersonation",
        },
        {
          access: "organization-admin",
          href: "/admin/configuration/general",
          icon: mdiCogOutline,
          label: "shell.nav.configuration",
        },
        {
          access: "organization-admin",
          href: "/admin/activity",
          icon: mdiClipboardTextOutline,
          label: "shell.nav.activity",
        },
      ],
    },
    {
      access: "realm-admin",
      label: null,
      scope: "realm",
      items: [
        { access: "realm-admin", href: "/admin/realm", icon: mdiCogOutline, label: "shell.nav.realmOverviewSettings" },
        {
          access: "realm-admin",
          href: "/admin/realm/administrators",
          icon: mdiShieldCrownOutline,
          label: "shell.nav.realmAdministrators",
        },
        {
          access: "realm-admin",
          href: "/admin/organizations",
          icon: mdiOfficeBuildingOutline,
          label: "shell.nav.organizations",
        },
        {
          access: "realm-admin",
          href: "/admin/login-policy",
          icon: mdiTuneVariant,
          label: "shell.nav.loginPolicy",
        },
        { access: "realm-admin", href: "/admin/oidc-clients", icon: mdiOpenid, label: "shell.nav.oidcClients" },
        { access: "realm-admin", href: "/admin/signing-keys", icon: mdiKeyChain, label: "shell.nav.signingKeys" },
        {
          access: "realm-admin",
          href: "/admin/oidc-consents",
          icon: mdiCheckDecagramOutline,
          label: "shell.nav.applicationConsents",
        },
        {
          access: "realm-admin",
          href: "/admin/protocol-documents",
          icon: mdiFileDocumentOutline,
          label: "shell.nav.protocolDocuments",
        },
        { access: "realm-admin", href: "/admin/sessions", icon: mdiMonitorCellphone, label: "shell.nav.sessions" },
        {
          access: "realm-admin",
          href: "/admin/events",
          icon: mdiClipboardTextOutline,
          label: "shell.nav.auditEvents",
        },
        {
          access: "realm-admin",
          href: "/admin/sign-in",
          icon: mdiLogin,
          label: "shell.nav.administratorSignIn",
        },
      ],
    },
  ],
  invitations: [],
} as const satisfies Readonly<Record<"account" | "admin" | "invitations", readonly ProductionNavigationGroup[]>>
