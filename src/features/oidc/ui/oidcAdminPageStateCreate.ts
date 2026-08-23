import { createEffect, on } from "solid-js"
import type { Result } from "#result"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OidcClientCreateRequest } from "../public/oidcClientCreateRequestSchema.js"
import type { OidcClient } from "../public/oidcClientSchema.js"
import type { OidcClientStatus } from "../public/oidcClientStatusSchema.js"
import type { OidcClientUpdateRequest } from "../public/oidcClientUpdateRequestSchema.js"
import type { OidcConsent } from "../public/oidcConsentSchema.js"
import type { OidcDiscovery } from "../public/oidcDiscoverySchema.js"
import type { OidcJwks } from "../public/oidcJwksSchema.js"
import type { OidcSigningKey } from "../public/oidcSigningKeySchema.js"
import type { OidcAdminAdapter } from "./oidcAdminAdapter.js"
import { oidcAdminFailureStatusSelect } from "./oidcAdminFailureStatusSelect.js"
import type { OidcAdminIssuedSecret } from "./oidcAdminIssuedSecret.js"
import type { OidcAdminScreen } from "./oidcAdminScreenSchema.js"
import type { OidcAdminStatus } from "./oidcAdminStatusSchema.js"

type DirectoryUser = { readonly id: string; readonly label: string }
type FailedResult = { readonly code?: string; readonly errorMessage: string; readonly statusCode?: number }

type OidcAdminPageStateCreateOptions = {
  readonly adapter: OidcAdminAdapter
  readonly confirm: (message: string) => boolean | Promise<boolean>
  readonly clientId: () => string | undefined
  readonly consentUserId: () => string | undefined
  /**
   * Renders an already-issued one-time secret without a mutation. Only the demo adapter
   * supplies this, so the one-time state is reachable directly from a URL.
   */
  readonly issuedSecretSeed?: () => OidcAdminIssuedSecret | undefined
  /**
   * Records that a seeded one-time secret was acknowledged so it does not reappear after a
   * reload. It receives only the client identity and kind, never the secret value.
   */
  readonly onIssuedSecretAcknowledge?: (issued: OidcAdminIssuedSecret) => void
  readonly screen: () => OidcAdminScreen
}

/**
 * Shared, adapter-agnostic state for every OIDC administration screen. Views read only
 * from here, so production and demo render identically. Issued secrets never leave this
 * factory's memory: they are not persisted, logged, or re-fetchable.
 */
export function oidcAdminPageStateCreate(options: OidcAdminPageStateCreateOptions) {
  const adapter = options.adapter
  const status = createSignalObject<OidcAdminStatus>("loading")
  const error = createSignalObject<string | undefined>(undefined)
  const notice = createSignalObject<string | undefined>(undefined)
  const pendingId = createSignalObject<string | undefined>(undefined)
  const clients = createSignalObject<readonly OidcClient[]>([])
  const client = createSignalObject<OidcClient | undefined>(undefined)
  const signingKeys = createSignalObject<readonly OidcSigningKey[]>([])
  const consents = createSignalObject<readonly OidcConsent[]>([])
  const users = createSignalObject<readonly DirectoryUser[]>([])
  const discovery = createSignalObject<OidcDiscovery | undefined>(undefined)
  const jwks = createSignalObject<OidcJwks | undefined>(undefined)
  const issuedSecret = createSignalObject<OidcAdminIssuedSecret | undefined>(undefined)
  const secretAcknowledged = createSignalObject(false)
  const nextPageToken = createSignalObject<string | undefined>(undefined)
  const pageTokens = createSignalObject<readonly string[]>([])

  /** Every destructive action awaits an explicit confirmation that the operator can cancel. */
  const confirmed = async (key: Parameters<typeof messageTranslate>[0]) =>
    (await options.confirm(messageTranslate(key))) === true

  const fail = (result: FailedResult) => {
    error.set(result.errorMessage)
    status.set(oidcAdminFailureStatusSelect(result))
  }
  const pageToken = () => pageTokens.get().at(-1)
  const issuedSecretSeed = () => options.issuedSecretSeed?.()

  const load = async () => {
    status.set("loading")
    error.set(undefined)
    notice.set(undefined)
    const screen = options.screen()

    if (screen === "oidc-clients") {
      const listed = await adapter.clientList(pageToken())
      if (!listed.success) return fail(listed)
      clients.set(listed.data.items)
      nextPageToken.set(listed.data.nextPageToken)
      return status.set(listed.data.items.length === 0 ? "empty" : "ready")
    }

    if (screen === "oidc-client-detail") {
      const currentClientId = options.clientId()
      if (currentClientId === undefined) {
        error.set(messageTranslate("admin.oidc.clients.missingId"))
        return status.set("error")
      }
      const current = await adapter.clientGet(currentClientId)
      if (!current.success) return fail(current)
      client.set(current.data)
      return status.set("ready")
    }

    if (screen === "signing-keys") {
      const listed = await adapter.signingKeyList(pageToken())
      if (!listed.success) return fail(listed)
      signingKeys.set(listed.data.items)
      nextPageToken.set(listed.data.nextPageToken)
      return status.set(listed.data.items.length === 0 ? "empty" : "ready")
    }

    if (screen === "oidc-consents") {
      const directory = await adapter.users()
      if (!directory.success) return fail(directory)
      users.set(directory.data)
      const selectedUserId = options.consentUserId() ?? directory.data[0]?.id
      if (selectedUserId === undefined) {
        consents.set([])
        return status.set("empty")
      }
      const [listed, clientList] = await Promise.all([
        adapter.consentList(selectedUserId, pageToken()),
        adapter.clientList(),
      ])
      if (!listed.success) return fail(listed)
      if (clientList.success) clients.set(clientList.data.items)
      consents.set(listed.data.items)
      nextPageToken.set(listed.data.nextPageToken)
      return status.set(listed.data.items.length === 0 ? "empty" : "ready")
    }

    const [discovered, keys] = await Promise.all([adapter.discoveryGet(), adapter.jwksGet()])
    if (!discovered.success) return fail(discovered)
    if (!keys.success) return fail(keys)
    discovery.set(discovered.data)
    jwks.set(keys.data)
    status.set("ready")
  }

  const mutate = async <T>(id: string, operation: () => Promise<Result<T>>): Promise<T | undefined> => {
    pendingId.set(id)
    error.set(undefined)
    const result = await operation()
    pendingId.set(undefined)
    if (!result.success) {
      fail(result)
      return undefined
    }
    return result.data
  }

  createEffect(
    on(
      () =>
        `${options.screen()}:${options.clientId() ?? ""}:${options.consentUserId() ?? ""}:${pageTokens.get().length}`,
      load,
    ),
  )

  return {
    client: client.get,
    clientCreate: async (input: OidcClientCreateRequest) => {
      const created = await mutate("client:create", () => adapter.clientCreate(input))
      if (created === undefined) return false
      clients.set([...clients.get(), created.client])
      status.set("ready")
      notice.set("client-created")
      if (created.clientSecret !== undefined) {
        secretAcknowledged.set(false)
        issuedSecret.set({
          clientId: created.client.id,
          clientName: created.client.name,
          kind: "created",
          secret: created.clientSecret,
        })
      }
      return true
    },
    clientLifecycleSet: async (clientId: string, nextStatus: OidcClientStatus) => {
      if (nextStatus === "removed" && !(await confirmed("admin.oidc.clients.removeConfirm"))) return
      const updated = await mutate(`client:${clientId}`, () =>
        adapter.clientLifecycleSet(clientId, { status: nextStatus }),
      )
      if (updated === undefined) return
      client.set(updated)
      clients.set(clients.get().map((item) => (item.id === clientId ? updated : item)))
      notice.set("client-lifecycle")
    },
    clientName: (clientId: string) => clients.get().find((item) => item.id === clientId)?.name ?? clientId,
    clients: clients.get,
    clientSecretRevoke: async (clientId: string) => {
      if (!(await confirmed("admin.oidc.secret.revokeConfirm"))) return
      const updated = await mutate(`secret:${clientId}`, () => adapter.clientSecretRevoke(clientId))
      if (updated === undefined) return
      client.set(updated)
      clients.set(clients.get().map((item) => (item.id === clientId ? updated : item)))
      issuedSecret.set(undefined)
      notice.set("secret-revoked")
    },
    clientSecretRotate: async (clientId: string) => {
      if (!(await confirmed("admin.oidc.secret.rotateConfirm"))) return
      const rotated = await mutate(`secret:${clientId}`, () => adapter.clientSecretRotate(clientId))
      if (rotated === undefined) return
      client.set(rotated.client)
      clients.set(clients.get().map((item) => (item.id === clientId ? rotated.client : item)))
      notice.set("secret-rotated")
      if (rotated.clientSecret === undefined) return
      secretAcknowledged.set(false)
      issuedSecret.set({
        clientId: rotated.client.id,
        clientName: rotated.client.name,
        kind: "rotated",
        secret: rotated.clientSecret,
      })
    },
    clientUpdate: async (clientId: string, input: OidcClientUpdateRequest) => {
      const updated = await mutate(`client:${clientId}`, () => adapter.clientUpdate(clientId, input))
      if (updated === undefined) return false
      client.set(updated)
      clients.set(clients.get().map((item) => (item.id === clientId ? updated : item)))
      notice.set("client-saved")
      return true
    },
    consentRevoke: async (userId: string, clientId: string) => {
      if (!(await confirmed("admin.oidc.consents.revokeConfirm"))) return
      const revoked = await mutate(`consent:${clientId}`, () => adapter.consentRevoke(userId, clientId))
      if (revoked === undefined) return
      const remaining = consents.get().filter((item) => item.clientId !== clientId)
      consents.set(remaining)
      notice.set("consent-revoked")
      if (remaining.length === 0) status.set("empty")
    },
    consents: consents.get,
    discovery: discovery.get,
    error: error.get,
    hasNextPage: () => nextPageToken.get() !== undefined,
    hasPreviousPage: () => pageTokens.get().length > 0,
    /** The one-time secret, hidden as soon as it has been acknowledged. */
    issuedSecret: () => {
      if (secretAcknowledged.get()) return undefined
      return issuedSecret.get() ?? issuedSecretSeed()
    },
    issuedSecretAcknowledge: () => {
      // An acknowledged seeded secret must stay hidden across reloads in this browser session.
      const seeded = issuedSecret.get() === undefined ? issuedSecretSeed() : undefined
      if (seeded !== undefined) options.onIssuedSecretAcknowledge?.(seeded)
      secretAcknowledged.set(true)
      issuedSecret.set(undefined)
    },
    jwks: jwks.get,
    notice: notice.get,
    pageNext: () => {
      const token = nextPageToken.get()
      if (token === undefined) return
      pageTokens.set([...pageTokens.get(), token])
    },
    pagePrevious: () => pageTokens.set(pageTokens.get().slice(0, -1)),
    pendingId: pendingId.get,
    reload: () => void load(),
    signingKeyCreate: async () => {
      const created = await mutate("signing-key:create", () => adapter.signingKeyCreate())
      if (created === undefined) return
      signingKeys.set([created, ...signingKeys.get()])
      status.set("ready")
      notice.set("signing-key-created")
    },
    signingKeyRetire: async (signingKeyId: string) => {
      if (!(await confirmed("admin.oidc.keys.retireConfirm"))) return
      const updated = await mutate(`signing-key:${signingKeyId}`, () => adapter.signingKeyRetire(signingKeyId))
      if (updated === undefined) return
      signingKeys.set(signingKeys.get().map((item) => (item.id === signingKeyId ? updated : item)))
      notice.set("signing-key-retired")
    },
    signingKeyRotate: async () => {
      if (!(await confirmed("admin.oidc.keys.rotateConfirm"))) return
      const created = await mutate("signing-key:rotate", () => adapter.signingKeyRotate())
      if (created === undefined) return
      const listed = await adapter.signingKeyList()
      if (listed.success) signingKeys.set(listed.data.items)
      else signingKeys.set([created, ...signingKeys.get()])
      status.set("ready")
      notice.set("signing-key-rotated")
    },
    signingKeys: signingKeys.get,
    status: status.get,
    userLabel: (userId: string) => users.get().find((item) => item.id === userId)?.label ?? userId,
    users: users.get,
  }
}

export type OidcAdminPageState = ReturnType<typeof oidcAdminPageStateCreate>
