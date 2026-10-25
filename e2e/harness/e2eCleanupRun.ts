import { existsSync, readFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { createResult, createResultError, type Result } from "#result"
import { e2eCheckpointClear } from "./e2eCheckpointClear.js"
import { e2eCheckpointPathGet } from "./e2eCheckpointPathGet.js"
import { type E2eCheckpoint, type E2eCheckpointEntity } from "./e2eCheckpointSchema.js"
import { type E2eCleanupCandidate, e2eCleanupSelect } from "./e2eCleanupSelect.js"
import { e2eCleanupStaleStateRemove } from "./e2eCleanupStaleStateRemove.js"
import { e2eDevEnvironmentStatusGet } from "./e2eDevEnvironmentEnsure.js"
import { type E2eServiceApiClient, e2eServiceApiClientCreate } from "./e2eServiceApiClientCreate.js"
import { e2eServiceUserIdentityGet } from "./e2eServiceUserEnsure.js"
import { e2eStateDirResolve } from "./e2eStateDirResolve.js"
import { e2eTargetBaseUrlGet } from "./e2eTargetBaseUrlGet.js"
import type { E2eTarget } from "./e2eTargetSchema.js"
import { e2eTestNamePattern } from "./e2eTestNamePattern.js"

export type E2eCleanupOutcome = "failure" | "interrupted" | "success"

type E2eCleanupRunInput = {
  readonly baseUrl?: string
  readonly checkpoint: E2eCheckpoint | undefined
  readonly environment?: Readonly<Record<string, string | undefined>>
  readonly now?: Date
  readonly outcome: E2eCleanupOutcome
  readonly stateDir?: string
  readonly target: E2eTarget
}

export type E2eCleanupSummary = {
  readonly organizations: number
  readonly projects: number
  readonly users: number
}

const staleAfterMs = 24 * 60 * 60 * 1000

/**
 * End-of-run cleanup via the service user. Finds test-owned users, organizations and projects
 * (name pattern match), removes the stale ones (older than 24h; on success also the current
 * run's data), verifies via the API that none of the selected ids remain, drops stale
 * checkpoints and stale artifact dirs, and on success clears the current checkpoint. Cleanup
 * failure always returns an error so the orchestrator exits non-zero.
 */
export function e2eCleanupRun(input: E2eCleanupRunInput): Promise<Result<E2eCleanupSummary>> {
  const op = "e2eCleanupRun"
  const now = input.now ?? new Date()
  return (async (): Promise<Result<E2eCleanupSummary>> => {
    const stateDir = e2eCleanupStateDirResolve(input.stateDir)
    if (!stateDir.success) return stateDir
    const resolved = stateDir.data
    e2eCleanupStaleStateRemove(resolved, now, {
      devServerRunning: e2eDevEnvironmentStatusGet(resolved).running,
    })
    if (input.checkpoint !== undefined && input.checkpoint.target === input.target) {
      const staleRemoved = e2eCleanupStaleCheckpointRemove(resolved, input.target, now)
      if (!staleRemoved.success) return staleRemoved
    }

    const credentials = e2eCleanupServiceCredentialsResolve(input.target, resolved, input.environment)
    if (!credentials.success) return credentials
    const baseUrl = input.baseUrl ?? e2eTargetBaseUrlGet()
    const client = await e2eServiceApiClientCreate({
      baseUrl,
      password: credentials.data.password,
      username: credentials.data.username,
    })
    if (!client.success) return client
    const logout = async (): Promise<void> => {
      const closed = await client.data.close()
      if (!closed.success) process.stderr.write(`E2E cleanup logout reported: ${closed.errorMessage}\n`)
    }
    try {
      const cleaned = await e2eCleanupTargetRun(client.data, {
        checkpoint: input.checkpoint,
        now,
        outcome: input.outcome,
        serviceUserName: e2eServiceUserIdentityGet().userName,
      })
      await logout()
      if (!cleaned.success) return cleaned
      if (input.outcome === "success" && input.checkpoint !== undefined && input.checkpoint.target === input.target) {
        const cleared = e2eCheckpointClear(e2eCheckpointPathGet(resolved, input.target))
        if (!cleared.success) return cleared
      }
      return createResult(cleaned.data)
    } catch (error) {
      await logout()
      throw error
    }
  })().catch((error) =>
    createResultError(
      op,
      error instanceof Error && error.message.length > 0 ? error.message : "The E2E cleanup failed.",
    ),
  )
}

type E2eCleanupTargetRunOptions = {
  readonly checkpoint: E2eCheckpoint | undefined
  readonly now: Date
  readonly outcome: E2eCleanupOutcome
  readonly serviceUserName: string
}

async function e2eCleanupTargetRun(
  client: E2eServiceApiClient,
  options: E2eCleanupTargetRunOptions,
): Promise<Result<E2eCleanupSummary>> {
  const realmId = client.realmId
  const listed = await e2eCleanupEntitiesList(client, realmId)
  if (!listed.success) return listed
  const checkpointEntities = (options.checkpoint?.entities ?? []).filter(
    (entity): entity is E2eCheckpointEntity =>
      entity.kind === "user" || entity.kind === "organization" || entity.kind === "project",
  )
  const currentRunIds = new Set(checkpointEntities.map((entity) => entity.id))
  const selected = e2eCleanupSelect({
    currentRunIds,
    entities: [...checkpointEntities, ...listed.data],
    now: options.now,
    outcome: options.outcome,
    runId: options.checkpoint?.runId,
    serviceUserName: options.serviceUserName,
  })

  // Revoke realm-administrator grants of selected test users first so user purge can proceed.
  const administrators = await client.administratorsList(realmId)
  if (!administrators.success) return administrators
  const administratorByUser = new Map(
    administrators.data.items.map((item: { readonly userId: string }) => [item.userId, item]),
  )
  for (const user of selected.users) {
    if (!administratorByUser.has(user.id)) continue
    const revoked = await client.administratorRevoke(realmId, user.id)
    if (!revoked.success) {
      if (!("code" in revoked && revoked.code === "realms.administrator-not-found")) return revoked
    }
  }

  for (const project of selected.projects) {
    const deleted = await client.projectDelete(realmId, project.id)
    if (!deleted.success) {
      if (!e2eCleanupNotFoundErrorIs(deleted)) return deleted
    }
  }

  for (const organization of selected.organizations) {
    const removed = await e2eCleanupOrganizationRemove(client, realmId, organization)
    if (!removed.success) return removed
    const purged = await client.organizationPurge(realmId, organization.id)
    if (!purged.success) {
      if (!e2eCleanupNotFoundErrorIs(purged)) return purged
    }
  }

  for (const user of selected.users) {
    // Delete then purge back-to-back. Tolerated: the delete when the user is already
    // soft-deleted (state=deleted listing) or gone, the purge when the user is gone.
    const deleted = await client.userDelete(realmId, user.id)
    if (!deleted.success) {
      if (!e2eCleanupNotFoundErrorIs(deleted) && !e2eCleanupAlreadyDeletedErrorIs(deleted)) return deleted
    }
    const purged = await client.userPurge(realmId, user.id)
    if (!purged.success) {
      if (!e2eCleanupNotFoundErrorIs(purged)) return purged
    }
  }

  const verified = await e2eCleanupSelectionVerify(client, realmId, selected, options.serviceUserName)
  if (!verified.success) return verified
  return createResult({
    organizations: selected.organizations.length,
    projects: selected.projects.length,
    users: selected.users.length,
  })
}

async function e2eCleanupOrganizationRemove(
  client: E2eServiceApiClient,
  realmId: string,
  organization: E2eCleanupCandidate,
): Promise<Result<void>> {
  const removed = await client.organizationLifecycleSet(realmId, organization.id, "removed")
  if (removed.success) return createResult(undefined)
  if (e2eCleanupNotFoundErrorIs(removed)) return createResult(undefined)
  if ("code" in removed && (removed.code === "organizations.conflict" || removed.code === "organizations.not-active"))
    return createResult(undefined)
  return removed
}

async function e2eCleanupSelectionVerify(
  client: E2eServiceApiClient,
  realmId: string,
  selected: {
    readonly organizations: readonly E2eCleanupCandidate[]
    readonly projects: readonly E2eCleanupCandidate[]
    readonly users: readonly E2eCleanupCandidate[]
  },
  serviceUserName: string,
): Promise<Result<void>> {
  const op = "e2eCleanupRun"
  const listed = await e2eCleanupEntitiesList(client, realmId)
  if (!listed.success) return listed
  const remaining = listed.data.filter(
    (entity) =>
      entity.name !== serviceUserName &&
      e2eTestNamePattern.test(entity.name) &&
      (selected.users.some((user) => user.id === entity.id) ||
        selected.organizations.some((organization) => organization.id === entity.id) ||
        selected.projects.some((project) => project.id === entity.id)),
  )
  if (remaining.length === 0) return createResult(undefined)
  const detail = remaining.map((entity) => `${entity.kind}/${entity.id} (${entity.name})`).join(", ")
  return createResultError(
    op,
    `The E2E cleanup left ${remaining.length} entit${remaining.length === 1 ? "y" : "ies"} behind: ${detail}.`,
  )
}

async function e2eCleanupEntitiesList(
  client: E2eServiceApiClient,
  realmId: string,
): Promise<Result<E2eCleanupCandidate[]>> {
  const entities: E2eCleanupCandidate[] = []
  // Both the default and the deleted-state lists: soft-deleted users vanish from the
  // default list, so without the deleted list an interrupted cleanup would leak them.
  const activeUsers = await e2eCleanupUserPagesList(client, realmId, "active")
  if (!activeUsers.success) return activeUsers
  const deletedUsers = await e2eCleanupUserPagesList(client, realmId, "deleted")
  if (!deletedUsers.success) return deletedUsers
  entities.push(...activeUsers.data, ...deletedUsers.data)
  let pageToken: string | undefined
  for (let page = 0; page < 50; page += 1) {
    const listed = await client.organizationsList(realmId, pageToken)
    if (!listed.success) return listed
    for (const organization of listed.data.items) {
      if (!e2eTestNamePattern.test(organization.name)) continue
      entities.push({
        createdAt: organization.createdAt,
        id: organization.id,
        kind: "organization",
        name: organization.name,
      })
    }
    const next = listed.data.nextPageToken
    if (next === undefined || next.length === 0) break
    pageToken = next
  }
  pageToken = undefined
  for (let page = 0; page < 50; page += 1) {
    const listed = await client.projectsList(realmId, pageToken)
    if (!listed.success) return listed
    for (const project of listed.data.items) {
      if (!e2eTestNamePattern.test(project.name)) continue
      entities.push({ createdAt: project.createdAt, id: project.id, kind: "project", name: project.name })
    }
    const next = listed.data.nextPageToken
    if (next === undefined || next.length === 0) break
    pageToken = next
  }
  return createResult(entities)
}

async function e2eCleanupUserPagesList(
  client: E2eServiceApiClient,
  realmId: string,
  state: "active" | "deleted",
): Promise<Result<E2eCleanupCandidate[]>> {
  const entities: E2eCleanupCandidate[] = []
  let pageToken: string | undefined
  for (let page = 0; page < 50; page += 1) {
    const listed =
      state === "deleted"
        ? await client.usersDeletedList(realmId, pageToken)
        : await client.usersList(realmId, pageToken)
    if (!listed.success) return listed
    for (const user of listed.data.items) {
      if (!e2eTestNamePattern.test(user.userName)) continue
      entities.push({ createdAt: user.createdAt, id: user.id, kind: "user", name: user.userName })
    }
    const next = listed.data.nextPageToken
    if (next === undefined || next.length === 0) break
    pageToken = next
  }
  return createResult(entities)
}

function e2eCleanupStaleCheckpointRemove(stateDir: string, target: E2eTarget, now: Date): Result<void> {
  const path = e2eCheckpointPathGet(stateDir, target)
  if (!existsSync(path)) return createResult(undefined)
  let startedAt: Date | undefined
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as { startedAt?: unknown }
    if (typeof raw.startedAt === "string") {
      const parsed = new Date(raw.startedAt)
      if (!Number.isNaN(parsed.getTime())) startedAt = parsed
    }
  } catch {
    startedAt = undefined
  }
  if (startedAt === undefined) return createResult(undefined)
  if (now.getTime() - startedAt.getTime() < staleAfterMs) return createResult(undefined)
  try {
    rmSync(path, { force: true })
    return createResult(undefined)
  } catch {
    return createResultError("e2eCleanupRun", `Cannot delete the stale E2E checkpoint at ${path}.`)
  }
}

function e2eCleanupStateDirResolve(stateDir: string | undefined): Result<string> {
  if (stateDir !== undefined && stateDir.length > 0) return createResult(stateDir)
  return e2eStateDirResolve()
}

function e2eCleanupServiceCredentialsResolve(
  target: E2eTarget,
  stateDir: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Result<{ readonly password: string; readonly username: string }> {
  const op = "e2eCleanupRun"
  if (target === "dev") {
    let raw: { servicePassword?: unknown }
    try {
      raw = JSON.parse(readFileSync(join(stateDir, "dev", "env.json"), "utf8")) as {
        servicePassword?: unknown
      }
    } catch {
      return createResultError(
        op,
        "The dev environment is not provisioned. Run the dev target first so `<stateDir>/dev/env.json` exists.",
      )
    }
    const password = typeof raw.servicePassword === "string" ? raw.servicePassword : ""
    if (password.length === 0) return createResultError(op, "The dev environment has no service-user password.")
    return createResult({ password, username: e2eServiceUserIdentityGet().userName })
  }
  const username = environment.AUTHWORKS_E2E_SERVICE_USERNAME?.trim() ?? ""
  const password = environment.AUTHWORKS_E2E_SERVICE_PASSWORD ?? ""
  if (username.length === 0 || password.length === 0)
    return createResultError(
      op,
      "Live admin E2E requires AUTHWORKS_E2E_SERVICE_USERNAME and AUTHWORKS_E2E_SERVICE_PASSWORD.",
    )
  return createResult({ password, username })
}

function e2eCleanupNotFoundErrorIs(result: { readonly code?: string; readonly statusCode?: number }): boolean {
  return result.code?.endsWith(".not-found") === true
}

function e2eCleanupAlreadyDeletedErrorIs(result: { readonly code?: string }): boolean {
  return result.code === "users.already-deleted"
}
