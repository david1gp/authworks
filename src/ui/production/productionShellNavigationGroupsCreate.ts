import { mdiAccountMultipleOutline } from "@adaptive-ds/mdi/mdiAccountMultipleOutline.js"
import { mdiAccountStarOutline } from "@adaptive-ds/mdi/mdiAccountStarOutline.js"
import { mdiAccountSwitchOutline } from "@adaptive-ds/mdi/mdiAccountSwitchOutline.js"
import { mdiApplicationOutline } from "@adaptive-ds/mdi/mdiApplicationOutline.js"
import { mdiCheckDecagramOutline } from "@adaptive-ds/mdi/mdiCheckDecagramOutline.js"
import { mdiClipboardTextOutline } from "@adaptive-ds/mdi/mdiClipboardTextOutline.js"
import { mdiCogOutline } from "@adaptive-ds/mdi/mdiCogOutline.js"
import { mdiFileDocumentOutline } from "@adaptive-ds/mdi/mdiFileDocumentOutline.js"
import { mdiKeyChain } from "@adaptive-ds/mdi/mdiKeyChain.js"
import { mdiMonitorCellphone } from "@adaptive-ds/mdi/mdiMonitorCellphone.js"
import { mdiOfficeBuildingOutline } from "@adaptive-ds/mdi/mdiOfficeBuildingOutline.js"
import { mdiOpenid } from "@adaptive-ds/mdi/mdiOpenid.js"
import { mdiShieldCrownOutline } from "@adaptive-ds/mdi/mdiShieldCrownOutline.js"
import { mdiTuneVariant } from "@adaptive-ds/mdi/mdiTuneVariant.js"
import { mdiWhatsapp } from "@adaptive-ds/mdi/mdiWhatsapp.js"
import type { ProductionNavigationGroup } from "./productionNavigationGroup.js"

/**
 * Production administration navigation: the sidebar shows one context at a time.
 * Organization items render when an organization is selected, realm items render
 * when the realm is selected in the administration context switcher (realm
 * administrators only). All groups are always expanded. Organization hrefs carry
 * the current slug; realm hrefs are slug-free.
 */
export function productionShellNavigationGroupsCreate(organizationSlug: string): Readonly<{
  readonly account: readonly ProductionNavigationGroup[]
  readonly admin: readonly ProductionNavigationGroup[]
  readonly invitations: readonly ProductionNavigationGroup[]
}> {
  const orgBase = `/orgs/${organizationSlug}`
  return {
    account: [],
    admin: [
      {
        label: "shell.nav.organizationSwitcher",
        scope: "organization",
        items: [
          {
            access: "organization-member",
            href: `${orgBase}/users`,
            icon: mdiAccountMultipleOutline,
            label: "shell.nav.users",
          },
          {
            access: "organization-admin",
            href: `${orgBase}/roles`,
            icon: mdiAccountStarOutline,
            label: "shell.nav.roles",
          },
          {
            access: "organization-admin",
            href: `${orgBase}/projects`,
            icon: mdiApplicationOutline,
            label: "shell.nav.projects",
          },
          {
            access: "organization-admin",
            href: `${orgBase}/configuration/general`,
            icon: mdiCogOutline,
            label: "shell.nav.configuration",
          },
          {
            access: "organization-admin",
            href: `${orgBase}/impersonation`,
            icon: mdiAccountSwitchOutline,
            label: "shell.nav.impersonation",
          },
          {
            access: "organization-admin",
            href: `${orgBase}/activity`,
            icon: mdiClipboardTextOutline,
            label: "shell.nav.activity",
          },
        ],
      },
      {
        access: "realm-admin",
        label: "shell.nav.realmGroup",
        scope: "realm",
        items: [
          { access: "realm-admin", href: "/realm", icon: mdiCogOutline, label: "shell.nav.realmOverviewSettings" },
          {
            access: "realm-admin",
            href: "/realm/administrators",
            icon: mdiShieldCrownOutline,
            label: "shell.nav.realmAdministrators",
          },
          {
            access: "realm-admin",
            href: "/realm/organizations",
            icon: mdiOfficeBuildingOutline,
            label: "shell.nav.organizations",
          },
          {
            access: "realm-admin",
            href: "/realm/login-policy",
            icon: mdiTuneVariant,
            label: "shell.nav.loginPolicy",
          },
        ],
      },
      {
        access: "realm-admin",
        label: "shell.nav.oidcGroup",
        scope: "realm",
        items: [
          { access: "realm-admin", href: "/realm/oidc-clients", icon: mdiOpenid, label: "shell.nav.oidcClients" },
          { access: "realm-admin", href: "/realm/signing-keys", icon: mdiKeyChain, label: "shell.nav.signingKeys" },
          {
            access: "realm-admin",
            href: "/realm/oidc-consents",
            icon: mdiCheckDecagramOutline,
            label: "shell.nav.applicationConsents",
          },
          {
            access: "realm-admin",
            href: "/realm/protocol-documents",
            icon: mdiFileDocumentOutline,
            label: "shell.nav.protocolDocuments",
          },
        ],
      },
      {
        access: "realm-admin",
        label: "shell.nav.securityAuditGroup",
        scope: "realm",
        items: [
          { access: "realm-admin", href: "/realm/sessions", icon: mdiMonitorCellphone, label: "shell.nav.sessions" },
          {
            access: "realm-admin",
            href: "/realm/events",
            icon: mdiClipboardTextOutline,
            label: "shell.nav.auditEvents",
          },
          {
            access: "realm-admin",
            href: "/realm/whatsapp",
            icon: mdiWhatsapp,
            label: "shell.nav.whatsapp",
          },
        ],
      },
    ],
    invitations: [],
  }
}
