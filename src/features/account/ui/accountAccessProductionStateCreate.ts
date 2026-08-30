import { createEffect, on } from "solid-js"
import type { Result } from "#result"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import type { ProductionSessionContextValue } from "../../../ui/production/productionSessionContextValue.js"
import type { OidcConsent } from "../../oidc/public/oidcConsentSchema.js"
import type { OrganizationInvitation } from "../../organizations/public/organizationInvitationSchema.js"
import type { OrganizationMe } from "../../organizations/public/organizationMeSchema.js"
import { accountEffectiveAccessGroupGet } from "../model/accountEffectiveAccessGroupGet.js"
import { accountEffectiveAccessGroupsCreate } from "../model/accountEffectiveAccessGroupsCreate.js"
import { accountOrganizationMeGet } from "../model/accountOrganizationMeGet.js"
import { accountViewedOrganizationIdResolve } from "../model/accountViewedOrganizationIdResolve.js"
import type { AccountEffectiveAccessEntry } from "../public/accountEffectiveAccessEntrySchema.js"
import { accountAccessApiCreate } from "./accountAccessApiCreate.js"
import type { AccountAccessScreen } from "./accountAccessScreenSchema.js"
import type { AccountAccessStatus } from "./accountAccessStatusSchema.js"

type FailedResult = { readonly code?: string; readonly errorMessage: string; readonly statusCode?: number }

export function accountAccessProductionStateCreate(
  screen: () => AccountAccessScreen,
  options: {
    readonly session?: ProductionSessionContextValue
    readonly viewedOrganizationId?: () => string | undefined
    readonly viewedOrganizationSelect?: (organizationId: string) => void
  } = {},
) {
  const session = options.session ?? productionSessionContextGet()
  const api = accountAccessApiCreate({ baseUrl: window.location.origin })
  const status = createSignalObject<AccountAccessStatus>("loading")
  const error = createSignalObject<string | undefined>(undefined)
  const pendingId = createSignalObject<string | undefined>(undefined)
  const notice = createSignalObject<string | undefined>(undefined)
  const noticeOrganizationId = createSignalObject<string | undefined>(undefined)
  const organizations = createSignalObject<OrganizationMe[]>([])
  const consents = createSignalObject<OidcConsent[]>([])
  const invitations = createSignalObject<OrganizationInvitation[]>([])
  const invitation = createSignalObject<OrganizationInvitation | undefined>(undefined)
  const effectiveAccess = createSignalObject<AccountEffectiveAccessEntry[]>([])
  const effectiveAccessNextPageToken = createSignalObject<string | undefined>(undefined)
  const activeOrganizationId = () => {
    const organization = session.guard.organization
    return typeof organization === "object" ? organization.organizationId : undefined
  }
  const localViewedOrganizationId = createSignalObject<string | undefined>(activeOrganizationId())
  const viewedOrganizationId = options.viewedOrganizationId ?? localViewedOrganizationId.get
  let viewedOrganizationExplicit = false
  const realmId = () => {
    const realm = session.guard.realm
    return typeof realm === "object" ? realm.realmId : ""
  }
  const token = () => new URLSearchParams(window.location.search).get("token") ?? ""
  const effectiveAccessGroups = () => accountEffectiveAccessGroupsCreate(effectiveAccess.get())
  const viewedOrganization = () => accountOrganizationMeGet(organizations.get(), viewedOrganizationId())
  const viewedEffectiveAccessGroup = () =>
    accountEffectiveAccessGroupGet(effectiveAccessGroups(), viewedOrganizationId())
  const viewedOrganizationSynchronize = () => {
    const current = viewedOrganizationId()
    if (status.get() === "loading" && viewedOrganizationExplicit) return
    if (viewedOrganizationExplicit && accountOrganizationMeGet(organizations.get(), current) === undefined)
      viewedOrganizationExplicit = false
    const next = accountViewedOrganizationIdResolve({
      activeOrganizationId: activeOrganizationId(),
      organizations: organizations.get(),
      viewedOrganizationExplicit,
      viewedOrganizationId: current,
    })
    if (next !== current) localViewedOrganizationId.set(next)
  }

  const fail = (result: FailedResult, invitationOperation = false) => {
    error.set(result.errorMessage)
    if (result.statusCode === 401) return status.set("expired")
    if (result.statusCode === 403) return status.set("permission-denied")
    if (invitationOperation && result.code === "organizations.expired") return status.set("expired")
    if (invitationOperation && result.code === "organizations.not-found") return status.set("replayed")
    status.set("error")
  }
  let loadGeneration = 0
  const load = async () => {
    const generation = ++loadGeneration
    const loadScreen = screen()
    const loadRealmId = realmId()
    const loadOrganizationId =
      loadScreen === "organizations" || loadScreen === "effective-access"
        ? typeof session.guard.organization === "object"
          ? session.guard.organization.organizationId
          : undefined
        : undefined
    const isCurrentLoad = () =>
      generation === loadGeneration &&
      loadScreen === screen() &&
      loadRealmId === realmId() &&
      (loadScreen !== "organizations" && loadScreen !== "effective-access"
        ? true
        : loadOrganizationId === activeOrganizationId())
    status.set("loading")
    error.set(undefined)
    if (loadScreen === "organizations") {
      organizations.set([])
      const result = await api.organizationList(loadRealmId)
      if (!isCurrentLoad()) return
      if (!result.success) return fail(result)
      organizations.set(result.data.items)
      return status.set(result.data.items.length === 0 ? "empty" : "ready")
    }
    if (loadScreen === "effective-access") {
      effectiveAccess.set([])
      effectiveAccessNextPageToken.set(undefined)
      const result = await api.effectiveAccessList(loadRealmId, { pageSize: 25 })
      if (!isCurrentLoad()) return
      if (!result.success) return fail(result)
      effectiveAccess.set(result.data.items)
      effectiveAccessNextPageToken.set(result.data.nextPageToken)
      return status.set(result.data.items.length === 0 ? "empty" : "ready")
    }
    if (loadScreen === "consents") {
      const result = await api.consentList(loadRealmId)
      if (!isCurrentLoad()) return
      if (!result.success) return fail(result)
      consents.set(result.data.items)
      return status.set(result.data.items.length === 0 ? "empty" : "ready")
    }
    if (loadScreen === "invitations") {
      const result = await api.invitationList(loadRealmId)
      if (!isCurrentLoad()) return
      if (!result.success) return fail(result)
      invitations.set(result.data.items)
      return status.set(result.data.items.length === 0 ? "empty" : "ready")
    }
    if (token().length === 0) {
      error.set("missing-token")
      return status.set("error")
    }
    const result = await api.invitationInspect(loadRealmId, token())
    if (!isCurrentLoad()) return
    if (!result.success) return fail(result, true)
    invitation.set(result.data.invitation)
    status.set("ready")
  }
  const mutate = async <T>(id: string, operation: () => Promise<Result<T>>, invitationOperation = false) => {
    pendingId.set(id)
    error.set(undefined)
    const result = await operation()
    pendingId.set(undefined)
    if (!result.success) {
      fail(result, invitationOperation)
      return false
    }
    return true
  }

  createEffect(
    on(() => {
      const organizationScoped = screen() === "organizations" || screen() === "effective-access"
      const organization = organizationScoped ? session.guard.organization : undefined
      const organizationId = typeof organization === "object" ? organization.organizationId : ""
      return `${realmId()}:${screen()}:${token()}:${organizationId}`
    }, load),
  )
  if (options.viewedOrganizationId === undefined) createEffect(viewedOrganizationSynchronize)
  return {
    activeOrganizationId,
    consentRevoke: async (clientId: string) => {
      if (!window.confirm(messageTranslate("account.access.consentRevokeConfirm", { clientId }))) return
      const succeeded = await mutate(`consent:${clientId}`, () => api.consentRevoke(realmId(), clientId))
      if (!succeeded) return
      consents.set(consents.get().filter((item) => item.clientId !== clientId))
      noticeOrganizationId.set(undefined)
      notice.set("revoked")
      status.set(consents.get().length === 0 ? "empty" : "ready")
    },
    consents: consents.get,
    effectiveAccess: effectiveAccess.get,
    effectiveAccessGroups,
    effectiveAccessLoadMore: async () => {
      const pageToken = effectiveAccessNextPageToken.get()
      if (pageToken === undefined) return
      const loadGenerationSnapshot = loadGeneration
      const loadOrganizationId = activeOrganizationId()
      pendingId.set("effective-access:next")
      const result = await api.effectiveAccessList(realmId(), { pageSize: 25, pageToken })
      pendingId.set(undefined)
      if (loadGenerationSnapshot !== loadGeneration || loadOrganizationId !== activeOrganizationId()) return
      if (!result.success) return fail(result)
      effectiveAccess.set([...effectiveAccess.get(), ...result.data.items])
      effectiveAccessNextPageToken.set(result.data.nextPageToken)
    },
    effectiveAccessNextPageToken: effectiveAccessNextPageToken.get,
    error: error.get,
    invitation: invitation.get,
    invitationAccept: async () => {
      const succeeded = await mutate("invitation:accept", () => api.invitationAccept(realmId(), token()), true)
      if (succeeded) status.set("accepted")
    },
    invitationDecline: async () => {
      if (!window.confirm(messageTranslate("account.access.invitationDeclineConfirm"))) return
      const succeeded = await mutate("invitation:decline", () => api.invitationDecline(realmId(), token()), true)
      if (succeeded) status.set("declined")
    },
    invitations: invitations.get,
    notice: () => {
      const scopedOrganizationId = noticeOrganizationId.get()
      return scopedOrganizationId === undefined || scopedOrganizationId === activeOrganizationId()
        ? notice.get()
        : undefined
    },
    organizationSwitch: async (organizationId: string) => {
      if (pendingId.get() !== undefined || session.organizationSwitchPending()) return
      const succeeded = await mutate(`organization:${organizationId}`, () => session.organizationSelect(organizationId))
      if (!succeeded) return
      if (activeOrganizationId() !== organizationId) return
      noticeOrganizationId.set(organizationId)
      notice.set(organizations.get().find((item) => item.organization.id === organizationId)?.organization.name)
    },
    organizations: organizations.get,
    pendingId: () => pendingId.get() ?? (session.organizationSwitchPending() ? "organization:switch" : undefined),
    reload: () => {
      noticeOrganizationId.set(undefined)
      notice.set(undefined)
      void load()
    },
    status: status.get,
    viewedEffectiveAccessGroup,
    viewedOrganization,
    viewedOrganizationId,
    viewedOrganizationSelect: (organizationId: string) => {
      if (options.viewedOrganizationSelect !== undefined) return options.viewedOrganizationSelect(organizationId)
      if (options.viewedOrganizationId !== undefined) return
      if (accountOrganizationMeGet(organizations.get(), organizationId) === undefined) {
        viewedOrganizationExplicit = false
        viewedOrganizationSynchronize()
        return
      }
      viewedOrganizationExplicit = true
      localViewedOrganizationId.set(organizationId)
    },
  }
}
