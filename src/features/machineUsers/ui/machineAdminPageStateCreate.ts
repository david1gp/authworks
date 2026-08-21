import { createEffect, on } from "solid-js"
import type { Result } from "#result"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { MachineCredential } from "../public/machineCredentialSchema.js"
import type { MachineUserCreateRequest } from "../public/machineUserCreateRequestSchema.js"
import type { MachineUserStatus } from "../public/machineUserStatusSchema.js"
import type { MachineUser } from "../public/machineUserSchema.js"
import type { MachineAdminAdapter } from "./machineAdminAdapter.js"
import { machineAdminFailureStatusSelect } from "./machineAdminFailureStatusSelect.js"
import type { MachineAdminIssuedSecret } from "./machineAdminIssuedSecret.js"
import type { MachineAdminScreen } from "./machineAdminScreenSchema.js"
import type { MachineAdminStatus } from "./machineAdminStatusSchema.js"

type FailedResult = { readonly code?: string; readonly errorMessage: string; readonly statusCode?: number }

type MachineCredentialIssueInput = {
  readonly expiresAt?: number
  readonly name: string
  readonly scopes?: string[]
}

type MachineAdminPageStateCreateOptions = {
  readonly adapter: MachineAdminAdapter
  readonly confirm: (message: string) => boolean
  readonly machineUserId: () => string | undefined
  /**
   * Renders an already-issued one-time secret without a mutation. Only the demo adapter
   * supplies this, so the one-time state is reachable directly from a URL.
   */
  readonly issuedSecretSeed?: () => MachineAdminIssuedSecret | undefined
  /** Injected so credential expiry is deterministic in tests and demo fixtures. */
  readonly now: () => number
  readonly screen: () => MachineAdminScreen
}

/**
 * Shared, adapter-agnostic state for every machine-user administration screen. Views read
 * only from here, so production and demo render identically. Issued secrets never leave this
 * factory's memory: they are not persisted, logged, or re-fetchable.
 */
export function machineAdminPageStateCreate(options: MachineAdminPageStateCreateOptions) {
  const adapter = options.adapter
  const status = createSignalObject<MachineAdminStatus>("loading")
  const error = createSignalObject<string | undefined>(undefined)
  const notice = createSignalObject<string | undefined>(undefined)
  const pendingId = createSignalObject<string | undefined>(undefined)
  const machineUsers = createSignalObject<readonly MachineUser[]>([])
  const machineUser = createSignalObject<MachineUser | undefined>(undefined)
  const credentials = createSignalObject<readonly MachineCredential[]>([])
  const issuedSecret = createSignalObject<MachineAdminIssuedSecret | undefined>(undefined)
  const secretAcknowledged = createSignalObject(false)
  const nextPageToken = createSignalObject<string | undefined>(undefined)
  const pageTokens = createSignalObject<readonly string[]>([])

  const fail = (result: FailedResult) => {
    error.set(result.errorMessage)
    status.set(machineAdminFailureStatusSelect(result))
  }
  const pageToken = () => pageTokens.get().at(-1)
  const machineUserName = (machineUserId: string) =>
    machineUsers.get().find((item) => item.id === machineUserId)?.displayName ??
    (machineUser.get()?.id === machineUserId ? machineUser.get()?.displayName : undefined) ??
    machineUserId

  const load = async () => {
    status.set("loading")
    error.set(undefined)
    notice.set(undefined)
    const screen = options.screen()

    if (screen === "machine-users") {
      const listed = await adapter.machineUserList(pageToken())
      if (!listed.success) return fail(listed)
      machineUsers.set(listed.data.items)
      nextPageToken.set(listed.data.nextPageToken)
      return status.set(listed.data.items.length === 0 ? "empty" : "ready")
    }

    const currentMachineUserId = options.machineUserId()

    if (screen === "machine-user-detail") {
      if (currentMachineUserId === undefined) {
        error.set("A machine user must be selected for this destination.")
        return status.set("error")
      }
      const current = await adapter.machineUserGet(currentMachineUserId)
      if (!current.success) return fail(current)
      machineUser.set(current.data)
      const listed = await adapter.credentialList(currentMachineUserId, pageToken())
      if (!listed.success) return fail(listed)
      credentials.set(listed.data.items)
      nextPageToken.set(listed.data.nextPageToken)
      return status.set("ready")
    }

    // The credential overview resolves its subject from the directory when none is selected.
    const directory = await adapter.machineUserList()
    if (!directory.success) return fail(directory)
    machineUsers.set(directory.data.items)
    const selectedId = currentMachineUserId ?? directory.data.items[0]?.id
    if (selectedId === undefined) {
      credentials.set([])
      return status.set("empty")
    }
    const [current, listed] = await Promise.all([
      adapter.machineUserGet(selectedId),
      adapter.credentialList(selectedId, pageToken()),
    ])
    if (!current.success) return fail(current)
    if (!listed.success) return fail(listed)
    machineUser.set(current.data)
    credentials.set(listed.data.items)
    nextPageToken.set(listed.data.nextPageToken)
    status.set(listed.data.items.length === 0 ? "empty" : "ready")
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
  const credentialIssueApply = (credential: MachineCredential, secret: string, noticeKey: string) => {
    credentials.set([credential, ...credentials.get()])
    status.set("ready")
    notice.set(noticeKey)
    secretAcknowledged.set(false)
    issuedSecret.set({
      kind: credential.kind,
      machineUserName: machineUserName(credential.machineUserId),
      name: credential.name ?? credential.id,
      secret,
    })
  }

  createEffect(on(() => `${options.screen()}:${options.machineUserId() ?? ""}:${pageTokens.get().length}`, load))

  return {
    apiKeyCreate: async (machineUserId: string, input: MachineCredentialIssueInput) => {
      const issued = await mutate("credential:api-key", () =>
        adapter.apiKeyCreate(machineUserId, { ...input, machineUserId }),
      )
      if (issued === undefined) return false
      credentialIssueApply(issued.credential, issued.secret, "api-key-created")
      return true
    },
    clientSecretRotate: async (machineUserId: string) => {
      if (
        !options.confirm(
          "Rotate this client secret? The current secret stops working immediately and cannot be recovered.",
        )
      )
        return
      const rotated = await mutate(`client-secret:${machineUserId}`, () => adapter.clientSecretRotate(machineUserId))
      if (rotated === undefined) return
      machineUser.set(rotated.machineUser)
      machineUsers.set(machineUsers.get().map((item) => (item.id === machineUserId ? rotated.machineUser : item)))
      notice.set("client-secret-rotated")
      secretAcknowledged.set(false)
      issuedSecret.set({
        clientId: rotated.clientId,
        kind: "client_secret",
        machineUserName: rotated.machineUser.displayName,
        name: rotated.machineUser.displayName,
        secret: rotated.clientSecret,
      })
    },
    credentialRevoke: async (credentialId: string) => {
      if (!options.confirm("Revoke this credential? Anything using it stops working immediately.")) return
      const revoked = await mutate(`credential:${credentialId}`, () => adapter.credentialRevoke(credentialId))
      if (revoked === undefined) return
      credentials.set(credentials.get().map((item) => (item.id === credentialId ? revoked : item)))
      notice.set("credential-revoked")
    },
    credentialState: (credential: MachineCredential) => {
      if (credential.revokedAt !== undefined) return "revoked" as const
      if (credential.expiresAt !== undefined && credential.expiresAt <= options.now()) return "expired" as const
      return "active" as const
    },
    credentials: credentials.get,
    error: error.get,
    hasNextPage: () => nextPageToken.get() !== undefined,
    hasPreviousPage: () => pageTokens.get().length > 0,
    /** The one-time secret, hidden as soon as it has been acknowledged. */
    issuedSecret: () => {
      if (secretAcknowledged.get()) return undefined
      return issuedSecret.get() ?? options.issuedSecretSeed?.()
    },
    issuedSecretAcknowledge: () => {
      secretAcknowledged.set(true)
      issuedSecret.set(undefined)
    },
    machineUser: machineUser.get,
    machineUserCreate: async (input: MachineUserCreateRequest) => {
      const created = await mutate("machine-user:create", () => adapter.machineUserCreate(input))
      if (created === undefined) return false
      machineUsers.set([...machineUsers.get(), created.machineUser])
      status.set("ready")
      notice.set("machine-user-created")
      secretAcknowledged.set(false)
      issuedSecret.set({
        clientId: created.clientId,
        kind: "client_secret",
        machineUserName: created.machineUser.displayName,
        name: created.machineUser.displayName,
        secret: created.clientSecret,
      })
      return true
    },
    machineUserLifecycleSet: async (machineUserId: string, nextStatus: MachineUserStatus) => {
      if (
        nextStatus === "removed" &&
        !options.confirm(
          "Remove this machine user? Every credential it owns stops working immediately and cannot be restored.",
        )
      )
        return
      const updated = await mutate(`machine-user:${machineUserId}`, () =>
        adapter.machineUserLifecycleSet(machineUserId, { status: nextStatus }),
      )
      if (updated === undefined) return
      machineUser.set(updated)
      machineUsers.set(machineUsers.get().map((item) => (item.id === machineUserId ? updated : item)))
      notice.set("machine-user-lifecycle")
    },
    machineUserName,
    machineUsers: machineUsers.get,
    notice: notice.get,
    now: options.now,
    pageNext: () => {
      const token = nextPageToken.get()
      if (token === undefined) return
      pageTokens.set([...pageTokens.get(), token])
    },
    pagePrevious: () => pageTokens.set(pageTokens.get().slice(0, -1)),
    pendingId: pendingId.get,
    personalAccessTokenCreate: async (machineUserId: string, input: MachineCredentialIssueInput) => {
      const issued = await mutate("credential:pat", () =>
        adapter.personalAccessTokenCreate(machineUserId, { ...input, machineUserId }),
      )
      if (issued === undefined) return false
      credentialIssueApply(issued.credential, issued.secret, "personal-access-token-created")
      return true
    },
    reload: () => void load(),
    status: status.get,
  }
}

export type MachineAdminPageState = ReturnType<typeof machineAdminPageStateCreate>
