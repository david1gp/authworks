import { createEffect, on } from "solid-js"
import type { Result } from "#result"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import type { OidcConsent } from "../../oidc/public/oidcConsentSchema.js"
import type { OrganizationInvitation } from "../../organizations/public/organizationInvitationSchema.js"
import type { OrganizationMe } from "../../organizations/public/organizationMeSchema.js"
import { accountAccessApiCreate } from "./accountAccessApiCreate.js"
import type { AccountAccessScreen } from "./accountAccessScreenSchema.js"
import type { AccountAccessStatus } from "./accountAccessStatusSchema.js"

type FailedResult = { readonly code?: string; readonly errorMessage: string; readonly statusCode?: number }

export function accountAccessProductionStateCreate(screen: () => AccountAccessScreen) {
  const session = productionSessionContextGet()
  const api = accountAccessApiCreate({ baseUrl: window.location.origin })
  const status = createSignalObject<AccountAccessStatus>("loading")
  const error = createSignalObject<string | undefined>(undefined)
  const pendingId = createSignalObject<string | undefined>(undefined)
  const notice = createSignalObject<string | undefined>(undefined)
  const organizations = createSignalObject<OrganizationMe[]>([])
  const consents = createSignalObject<OidcConsent[]>([])
  const invitations = createSignalObject<OrganizationInvitation[]>([])
  const invitation = createSignalObject<OrganizationInvitation | undefined>(undefined)
  const initialOrganization = session.guard.organization
  const activeOrganizationId = createSignalObject(
    typeof initialOrganization === "object" ? initialOrganization.organizationId : undefined,
  )
  const realmId = () => {
    const realm = session.guard.realm
    return typeof realm === "object" ? realm.realmId : ""
  }
  const token = () => new URLSearchParams(window.location.search).get("token") ?? ""

  const fail = (result: FailedResult, invitationOperation = false) => {
    error.set(result.errorMessage)
    if (result.statusCode === 401) return status.set("expired")
    if (result.statusCode === 403) return status.set("permission-denied")
    if (invitationOperation && result.code === "organizations.expired") return status.set("expired")
    if (invitationOperation && result.code === "organizations.not-found") return status.set("replayed")
    status.set("error")
  }
  const load = async () => {
    status.set("loading")
    error.set(undefined)
    notice.set(undefined)
    if (screen() === "organizations") {
      const result = await api.organizationList(realmId())
      if (!result.success) return fail(result)
      organizations.set(result.data.items)
      return status.set(result.data.items.length === 0 ? "empty" : "ready")
    }
    if (screen() === "consents") {
      const result = await api.consentList(realmId())
      if (!result.success) return fail(result)
      consents.set(result.data.items)
      return status.set(result.data.items.length === 0 ? "empty" : "ready")
    }
    if (screen() === "invitations") {
      const result = await api.invitationList(realmId())
      if (!result.success) return fail(result)
      invitations.set(result.data.items)
      return status.set(result.data.items.length === 0 ? "empty" : "ready")
    }
    if (token().length === 0) {
      error.set("missing-token")
      return status.set("error")
    }
    const result = await api.invitationInspect(realmId(), token())
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

  createEffect(on(() => `${realmId()}:${screen()}:${token()}`, load))
  return {
    activeOrganizationId: activeOrganizationId.get,
    consentRevoke: async (clientId: string) => {
      if (!window.confirm(messageTranslate("account.access.consentRevokeConfirm", { clientId }))) return
      const succeeded = await mutate(`consent:${clientId}`, () => api.consentRevoke(realmId(), clientId))
      if (!succeeded) return
      consents.set(consents.get().filter((item) => item.clientId !== clientId))
      notice.set("revoked")
      status.set(consents.get().length === 0 ? "empty" : "ready")
    },
    consents: consents.get,
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
    notice: notice.get,
    organizationSwitch: async (organizationId: string) => {
      const succeeded = await mutate(`organization:${organizationId}`, () =>
        api.organizationSwitch(realmId(), organizationId),
      )
      if (!succeeded) return
      activeOrganizationId.set(organizationId)
      session.organizationSelect(organizationId)
      notice.set(organizations.get().find((item) => item.organization.id === organizationId)?.organization.name)
    },
    organizations: organizations.get,
    pendingId: pendingId.get,
    reload: () => void load(),
    status: status.get,
  }
}
