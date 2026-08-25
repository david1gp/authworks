import { mdiAccountCircleOutline } from "@adaptive-ds/mdi/mdiAccountCircleOutline.js"
import { mdiAccountMultipleOutline } from "@adaptive-ds/mdi/mdiAccountMultipleOutline.js"
import { mdiAccountRemoveOutline } from "@adaptive-ds/mdi/mdiAccountRemoveOutline.js"
import { mdiAccountSwitchOutline } from "@adaptive-ds/mdi/mdiAccountSwitchOutline.js"
import { mdiApplicationOutline } from "@adaptive-ds/mdi/mdiApplicationOutline.js"
import { mdiCheckDecagramOutline } from "@adaptive-ds/mdi/mdiCheckDecagramOutline.js"
import { mdiClipboardTextOutline } from "@adaptive-ds/mdi/mdiClipboardTextOutline.js"
import { mdiCogOutline } from "@adaptive-ds/mdi/mdiCogOutline.js"
import { mdiDomain } from "@adaptive-ds/mdi/mdiDomain.js"
import { mdiEmailOutline } from "@adaptive-ds/mdi/mdiEmailOutline.js"
import { mdiEmailPlusOutline } from "@adaptive-ds/mdi/mdiEmailPlusOutline.js"
import { mdiFileDocumentOutline } from "@adaptive-ds/mdi/mdiFileDocumentOutline.js"
import { mdiFingerprint } from "@adaptive-ds/mdi/mdiFingerprint.js"
import { mdiKeyChain } from "@adaptive-ds/mdi/mdiKeyChain.js"
import { mdiKeyOutline } from "@adaptive-ds/mdi/mdiKeyOutline.js"
import { mdiLifebuoy } from "@adaptive-ds/mdi/mdiLifebuoy.js"
import { mdiLinkVariant } from "@adaptive-ds/mdi/mdiLinkVariant.js"
import { mdiLockOpenOutline } from "@adaptive-ds/mdi/mdiLockOpenOutline.js"
import { mdiLockOutline } from "@adaptive-ds/mdi/mdiLockOutline.js"
import { mdiLogin } from "@adaptive-ds/mdi/mdiLogin.js"
import { mdiMonitorCellphone } from "@adaptive-ds/mdi/mdiMonitorCellphone.js"
import { mdiOfficeBuildingOutline } from "@adaptive-ds/mdi/mdiOfficeBuildingOutline.js"
import { mdiOpenid } from "@adaptive-ds/mdi/mdiOpenid.js"
import { mdiPaletteOutline } from "@adaptive-ds/mdi/mdiPaletteOutline.js"
import { mdiRobotOutline } from "@adaptive-ds/mdi/mdiRobotOutline.js"
import { mdiShieldKeyOutline } from "@adaptive-ds/mdi/mdiShieldKeyOutline.js"
import { mdiShieldLockOutline } from "@adaptive-ds/mdi/mdiShieldLockOutline.js"
import { mdiTuneVariant } from "@adaptive-ds/mdi/mdiTuneVariant.js"
import { mdiViewDashboardOutline } from "@adaptive-ds/mdi/mdiViewDashboardOutline.js"
import type { ProductionNavigationGroup } from "./productionNavigationGroup.js"

export const productionShellNavigationGroups = {
  account: [
    {
      icon: mdiAccountCircleOutline,
      label: "shell.nav.personalInformation",
      items: [
        { href: "/account", icon: mdiViewDashboardOutline, label: "shell.nav.overview" },
        { href: "/account/profile", icon: mdiAccountCircleOutline, label: "shell.nav.profile" },
        { href: "/account/email", icon: mdiEmailOutline, label: "shell.nav.emailAddress" },
        { href: "/account/organizations", icon: mdiOfficeBuildingOutline, label: "shell.nav.organizations" },
      ],
    },
    {
      icon: mdiShieldLockOutline,
      label: "shell.nav.security",
      items: [
        { href: "/account/password", icon: mdiLockOutline, label: "shell.nav.password" },
        { href: "/account/sessions", icon: mdiMonitorCellphone, label: "shell.nav.sessionsDevices" },
        { href: "/account/passkeys", icon: mdiFingerprint, label: "shell.nav.passkeys" },
        { href: "/account/factors", icon: mdiShieldKeyOutline, label: "shell.nav.mfa" },
        { href: "/account/recovery-codes", icon: mdiLifebuoy, label: "shell.nav.recoveryCodes" },
        { href: "/account/identities", icon: mdiLinkVariant, label: "shell.nav.linkedIdentities" },
      ],
    },
    {
      icon: mdiLockOpenOutline,
      label: "shell.nav.access",
      items: [
        { href: "/account/consents", icon: mdiCheckDecagramOutline, label: "shell.nav.applicationConsents" },
        { href: "/account/delete", icon: mdiAccountRemoveOutline, label: "shell.nav.deleteAccount" },
      ],
    },
  ],
  admin: [
    {
      icon: mdiDomain,
      label: "shell.nav.realm",
      items: [
        { href: "/admin", icon: mdiViewDashboardOutline, label: "shell.nav.overview" },
        { href: "/admin/realm", icon: mdiCogOutline, label: "shell.nav.realmSettings" },
        { href: "/admin/sign-in", icon: mdiLogin, label: "shell.nav.administratorSignIn" },
        { href: "/admin/branding", icon: mdiPaletteOutline, label: "shell.nav.branding" },
        { href: "/admin/login-policy", icon: mdiTuneVariant, label: "shell.nav.loginPolicy" },
      ],
    },
    {
      icon: mdiAccountMultipleOutline,
      label: "shell.nav.directory",
      items: [
        { href: "/admin/organizations", icon: mdiOfficeBuildingOutline, label: "shell.nav.organizations" },
        { href: "/admin/users", icon: mdiAccountMultipleOutline, label: "shell.nav.users" },
        { href: "/admin/impersonation", icon: mdiAccountSwitchOutline, label: "shell.nav.impersonation" },
        { href: "/admin/machine-users", icon: mdiRobotOutline, label: "shell.nav.machineUsers" },
        { href: "/admin/machine-credentials", icon: mdiKeyOutline, label: "shell.nav.credentialsTokens" },
      ],
    },
    {
      icon: mdiApplicationOutline,
      label: "shell.nav.applications",
      items: [{ href: "/admin/projects", icon: mdiApplicationOutline, label: "shell.nav.projects" }],
    },
    {
      icon: mdiOpenid,
      label: "shell.nav.openIdConnect",
      items: [
        { href: "/admin/oidc-clients", icon: mdiOpenid, label: "shell.nav.oidcClients" },
        { href: "/admin/signing-keys", icon: mdiKeyChain, label: "shell.nav.signingKeys" },
        { href: "/admin/oidc-consents", icon: mdiCheckDecagramOutline, label: "shell.nav.applicationConsents" },
        { href: "/admin/protocol-documents", icon: mdiFileDocumentOutline, label: "shell.nav.protocolDocuments" },
      ],
    },
    {
      icon: mdiClipboardTextOutline,
      label: "shell.nav.operations",
      items: [
        { href: "/admin/sessions", icon: mdiMonitorCellphone, label: "shell.nav.sessions" },
        { href: "/admin/events", icon: mdiClipboardTextOutline, label: "shell.nav.auditEvents" },
      ],
    },
  ],
  invitations: [
    {
      icon: mdiAccountCircleOutline,
      label: "shell.nav.account",
      items: [
        { href: "/account", icon: mdiViewDashboardOutline, label: "shell.nav.overview" },
        { href: "/account/organizations", icon: mdiOfficeBuildingOutline, label: "shell.nav.organizations" },
        { href: "/invitations", icon: mdiEmailPlusOutline, label: "shell.nav.invitations" },
      ],
    },
  ],
} as const satisfies Readonly<Record<"account" | "admin" | "invitations", readonly ProductionNavigationGroup[]>>
