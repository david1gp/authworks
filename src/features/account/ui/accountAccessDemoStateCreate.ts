import { useLocation } from "@solidjs/router"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { demoAccountScenarioGroups } from "../../demo/demoAccountScenarioGroups.js"
import { demoFixtureScenarioHrefBuild } from "../../demo/demoFixtureScenarioHrefBuild.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import type { OidcConsent } from "../../oidc/public/oidcConsentSchema.js"
import type { OrganizationInvitation } from "../../organizations/public/organizationInvitationSchema.js"
import type { OrganizationMe } from "../../organizations/public/organizationMeSchema.js"
import type { AccountAccessScreen } from "./accountAccessScreenSchema.js"
import type { AccountAccessStatus } from "./accountAccessStatusSchema.js"

const now = Date.UTC(2026, 7, 21, 9, 30)
const organizationFixtures: OrganizationMe[] = [
  {
    membership: {
      createdAt: now - 8_640_000_000,
      id: "membership-northwind",
      organizationId: "northwind",
      realmId: "customer-identity",
      roles: ["owner", "admin"],
      updatedAt: now - 86_400_000,
      userId: "demo-user",
    },
    organization: {
      createdAt: now - 31_536_000_000,
      id: "northwind",
      name: "Northwind Labs",
      realmId: "customer-identity",
      status: "active",
      updatedAt: now - 86_400_000,
    },
  },
  {
    membership: {
      createdAt: now - 2_592_000_000,
      id: "membership-field-notes",
      organizationId: "field-notes",
      realmId: "customer-identity",
      roles: ["member"],
      updatedAt: now - 172_800_000,
      userId: "demo-user",
    },
    organization: {
      createdAt: now - 15_768_000_000,
      id: "field-notes",
      name: "Field Notes",
      realmId: "customer-identity",
      status: "active",
      updatedAt: now - 172_800_000,
    },
  },
]
const consentFixtures: OidcConsent[] = [
  {
    clientId: "analytics-dashboard",
    createdAt: now - 2_592_000_000,
    realmId: "customer-identity",
    scope: ["openid", "profile", "email"],
    updatedAt: now - 86_400_000,
    userId: "demo-user",
  },
  {
    clientId: "expense-mobile",
    createdAt: now - 604_800_000,
    realmId: "customer-identity",
    scope: ["openid", "profile"],
    updatedAt: now - 604_800_000,
    userId: "demo-user",
  },
]
const invitationFixture: OrganizationInvitation = {
  acceptedAt: null,
  createdAt: now - 86_400_000,
  email: "avery@example.com",
  expiresAt: now + 604_800_000,
  id: "invitation-northwind",
  organizationId: "northwind",
  realmId: "customer-identity",
  roles: ["member"],
  status: "pending",
  updatedAt: now - 86_400_000,
}

export function accountAccessDemoStateCreate(screen: () => AccountAccessScreen) {
  const location = useLocation()
  const scenario = () => demoFixtureScenarioSelect(location.pathname, demoAccountScenarioGroups)
  const selected = () => demoFixtureStateSelect(location.search, scenario()?.states ?? ["success"])
  const organizations = createSignalObject([...organizationFixtures])
  const consents = createSignalObject([...consentFixtures])
  const invitations = createSignalObject([invitationFixture])
  const activeOrganizationId = createSignalObject("northwind")
  const notice = createSignalObject<string | undefined>(undefined)
  const outcome = createSignalObject<AccountAccessStatus | undefined>(undefined)
  const status = (): AccountAccessStatus => {
    if (outcome.get() !== undefined) return outcome.get() as AccountAccessStatus
    const current = selected()
    if (current === "success") {
      const collection =
        screen() === "organizations"
          ? organizations.get()
          : screen() === "consents"
            ? consents.get()
            : invitations.get()
      return collection.length === 0 ? "empty" : "ready"
    }
    // States that only affect how a value is presented, and states owned by other features,
    // still render the ready page.
    const presentational: readonly string[] = [
      "one-time",
      "cross-tenant",
      "redacted",
      "assurance-required",
      "active",
      "expiring",
      "nested-rejected",
      "ended",
    ]
    return presentational.includes(current) ? "ready" : (current as AccountAccessStatus)
  }
  return {
    activeOrganizationId: activeOrganizationId.get,
    consentRevoke: (clientId: string) => {
      consents.set(consents.get().filter((item) => item.clientId !== clientId))
      notice.set("revoked")
    },
    consents: () => (selected() === "empty" ? [] : consents.get()),
    error: () => (selected() === "error" ? "The deterministic account fixture failed." : undefined),
    invitation: () => invitationFixture,
    invitationAccept: () => outcome.set("accepted"),
    invitationDecline: () => outcome.set("declined"),
    invitations: () => (selected() === "empty" ? [] : invitations.get()),
    notice: notice.get,
    organizationSwitch: (organizationId: string) => {
      activeOrganizationId.set(organizationId)
      notice.set(organizations.get().find((item) => item.organization.id === organizationId)?.organization.name)
    },
    organizations: () => (selected() === "empty" ? [] : organizations.get()),
    pendingId: () => undefined,
    reload: () => undefined,
    status,
    stateOptions: () =>
      (scenario()?.states ?? ["success"]).map((fixtureState) => ({
        href: demoFixtureScenarioHrefBuild(location.pathname, fixtureState),
        label: fixtureState,
        selected: fixtureState === selected(),
      })),
  }
}
