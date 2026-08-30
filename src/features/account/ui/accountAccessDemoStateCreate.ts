import { useLocation } from "@solidjs/router"
import { createEffect } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { demoAccountScenarioGroups } from "../../demo/demoAccountScenarioGroups.js"
import { demoFixtureScenarioHrefBuild } from "../../demo/demoFixtureScenarioHrefBuild.js"
import { demoFixtureScenarioSelect } from "../../demo/demoFixtureScenarioSelect.js"
import { demoFixtureStateSelect } from "../../demo/demoFixtureStateSelect.js"
import { demoFixtureStateLabel } from "../../demo/public/demoFixtureStateLabel.js"
import type { OidcConsent } from "../../oidc/public/oidcConsentSchema.js"
import type { OrganizationInvitation } from "../../organizations/public/organizationInvitationSchema.js"
import type { OrganizationMe } from "../../organizations/public/organizationMeSchema.js"
import { accountEffectiveAccessGroupGet } from "../model/accountEffectiveAccessGroupGet.js"
import { accountEffectiveAccessGroupsCreate } from "../model/accountEffectiveAccessGroupsCreate.js"
import { accountOrganizationMeGet } from "../model/accountOrganizationMeGet.js"
import { accountViewedOrganizationIdResolve } from "../model/accountViewedOrganizationIdResolve.js"
import type { AccountEffectiveAccessEntry } from "../public/accountEffectiveAccessEntrySchema.js"
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
const effectiveAccessFixtures: AccountEffectiveAccessEntry[] = [
  {
    id: "organization:northwind",
    organization: organizationFixtures[0]!,
    permissions: ["organization.read", "organization.switch", "project.read"],
    roleKeys: ["admin", "owner"],
    source: "membership",
  },
  {
    id: "project:customer-portal:organization:northwind",
    organization: organizationFixtures[0]!,
    permissions: ["organization.read", "organization.switch", "project.read"],
    project: {
      authorizationRequired: true,
      createdAt: now - 30_000_000,
      id: "customer-portal",
      name: "Customer portal",
      organizationId: "northwind",
      projectAccessRequired: true,
      realmId: "customer-identity",
      status: "active",
      updatedAt: now - 86_400_000,
    },
    roleKeys: ["admin", "owner"],
    source: "project-owner",
  },
]

export function accountAccessDemoStateCreate(
  screen: () => AccountAccessScreen,
  options: {
    readonly viewedOrganizationId?: () => string | undefined
    readonly viewedOrganizationSelect?: (organizationId: string) => void
  } = {},
) {
  const location = useLocation()
  const scenario = () => demoFixtureScenarioSelect(location.pathname, demoAccountScenarioGroups)
  const selected = () => demoFixtureStateSelect(location.search, scenario()?.states ?? ["success"])
  const organizations = createSignalObject([...organizationFixtures])
  const consents = createSignalObject([...consentFixtures])
  const invitations = createSignalObject([invitationFixture])
  const effectiveAccess = createSignalObject([...effectiveAccessFixtures])
  const activeOrganizationId = createSignalObject("northwind")
  const localViewedOrganizationId = createSignalObject<string | undefined>(activeOrganizationId.get())
  const viewedOrganizationId = options.viewedOrganizationId ?? localViewedOrganizationId.get
  let viewedOrganizationExplicit = false
  const notice = createSignalObject<string | undefined>(undefined)
  const outcome = createSignalObject<AccountAccessStatus | undefined>(undefined)
  const availableOrganizations = () => (selected() === "empty" ? [] : organizations.get())
  const availableEffectiveAccess = () => (selected() === "empty" ? [] : effectiveAccess.get())
  const effectiveAccessGroups = () => accountEffectiveAccessGroupsCreate(availableEffectiveAccess())
  const viewedOrganization = () => accountOrganizationMeGet(availableOrganizations(), viewedOrganizationId())
  const viewedEffectiveAccessGroup = () =>
    accountEffectiveAccessGroupGet(effectiveAccessGroups(), viewedOrganizationId())
  const viewedOrganizationSynchronize = () => {
    const current = viewedOrganizationId()
    if (viewedOrganizationExplicit && accountOrganizationMeGet(availableOrganizations(), current) === undefined)
      viewedOrganizationExplicit = false
    const next = accountViewedOrganizationIdResolve({
      activeOrganizationId: activeOrganizationId.get(),
      organizations: availableOrganizations(),
      viewedOrganizationExplicit,
      viewedOrganizationId: current,
    })
    if (next !== current) localViewedOrganizationId.set(next)
  }
  const statusFor = (collection: readonly unknown[]): AccountAccessStatus => {
    if (outcome.get() !== undefined) return outcome.get() as AccountAccessStatus
    const current = selected()
    if (current === "success") {
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
  const organizationStatus = () => statusFor(organizations.get())
  const status = (): AccountAccessStatus => {
    const collection =
      screen() === "organizations"
        ? organizations.get()
        : screen() === "consents"
          ? consents.get()
          : screen() === "effective-access"
            ? effectiveAccess.get()
            : invitations.get()
    return statusFor(collection)
  }
  if (options.viewedOrganizationId === undefined) createEffect(viewedOrganizationSynchronize)
  return {
    activeOrganizationId: activeOrganizationId.get,
    consentRevoke: (clientId: string) => {
      if (!window.confirm(messageTranslate("account.access.consentRevokeConfirm", { clientId }))) return
      consents.set(consents.get().filter((item) => item.clientId !== clientId))
      notice.set("revoked")
    },
    consents: () => (selected() === "empty" ? [] : consents.get()),
    effectiveAccess: availableEffectiveAccess,
    effectiveAccessGroups,
    effectiveAccessLoadMore: () => undefined,
    effectiveAccessNextPageToken: () => undefined,
    error: () => (selected() === "error" ? messageTranslate("demo.fixture.accountError") : undefined),
    invitation: () => invitationFixture,
    invitationAccept: () => outcome.set("accepted"),
    invitationDecline: () => {
      if (!window.confirm(messageTranslate("account.access.invitationDeclineConfirm"))) return
      outcome.set("declined")
    },
    invitations: () => (selected() === "empty" ? [] : invitations.get()),
    notice: notice.get,
    organizationSwitch: (organizationId: string) => {
      activeOrganizationId.set(organizationId)
      notice.set(organizations.get().find((item) => item.organization.id === organizationId)?.organization.name)
    },
    organizationStatus,
    organizations: () => (selected() === "empty" ? [] : organizations.get()),
    pendingId: () => undefined,
    reload: () => undefined,
    status,
    stateOptions: () =>
      (scenario()?.states ?? ["success"]).map((fixtureState) => ({
        href: demoFixtureScenarioHrefBuild(location.pathname, fixtureState),
        label: demoFixtureStateLabel(fixtureState),
        selected: fixtureState === selected(),
      })),
    viewedEffectiveAccessGroup,
    viewedOrganization,
    viewedOrganizationId,
    viewedOrganizationSelect: (organizationId: string) => {
      if (options.viewedOrganizationSelect !== undefined) return options.viewedOrganizationSelect(organizationId)
      if (options.viewedOrganizationId !== undefined) return
      if (accountOrganizationMeGet(availableOrganizations(), organizationId) === undefined) {
        viewedOrganizationExplicit = false
        viewedOrganizationSynchronize()
        return
      }
      viewedOrganizationExplicit = true
      localViewedOrganizationId.set(organizationId)
    },
  }
}
