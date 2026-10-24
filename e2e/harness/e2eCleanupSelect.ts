import type { E2eCheckpointEntity } from "./e2eCheckpointSchema.js"
import { e2eTestNameCreatedAtParse } from "./e2eTestNameCreatedAtParse.js"
import { e2eTestNamePattern } from "./e2eTestNamePattern.js"

export type E2eCleanupEntityKind = "organization" | "project" | "user"

export type E2eCleanupCandidate = {
  readonly createdAt: number | undefined
  readonly id: string
  readonly kind: E2eCleanupEntityKind
  readonly name: string
}

type E2eCleanupSelectInput = {
  readonly currentRunIds: ReadonlySet<string>
  readonly entities: readonly (E2eCleanupCandidate | E2eCheckpointEntity)[]
  readonly now?: Date
  readonly outcome: "failure" | "interrupted" | "success"
  readonly runId: string | undefined
  readonly serviceUserName: string
}

export type E2eCleanupSelected = {
  readonly users: readonly E2eCleanupCandidate[]
  readonly organizations: readonly E2eCleanupCandidate[]
  readonly projects: readonly E2eCleanupCandidate[]
}

const staleAfterMs = 24 * 60 * 60 * 1000

/**
 * Selects test-owned entities for removal. An entity is selectable only when its name matches
 * the test-name pattern; the service user is never selected. Selection: name timestamp older
 * than 24h (server createdAt agrees when present), or — on success only — members of the
 * current run (checkpoint entity ids plus matching runId names). Split by kind for ordered
 * removal (projects, then organizations, then users).
 */
export function e2eCleanupSelect(input: E2eCleanupSelectInput): E2eCleanupSelected {
  const now = input.now ?? new Date()
  const users: E2eCleanupCandidate[] = []
  const organizations: E2eCleanupCandidate[] = []
  const projects: E2eCleanupCandidate[] = []
  const seen = new Set<string>()
  const push = (entity: E2eCleanupCandidate): void => {
    const key = `${entity.kind}/${entity.id}`
    if (seen.has(key)) return
    seen.add(key)
    if (entity.kind === "user") users.push(entity)
    else if (entity.kind === "organization") organizations.push(entity)
    else projects.push(entity)
  }
  for (const entity of input.entities) {
    const kind = entity.kind
    if (kind !== "user" && kind !== "organization" && kind !== "project") continue
    const candidate: E2eCleanupCandidate = {
      createdAt: e2eCleanupCandidateCreatedAtGet(entity),
      id: entity.id,
      kind,
      name: entity.name,
    }
    if (candidate.id.length === 0 || candidate.name.length === 0) continue
    if (candidate.name === input.serviceUserName) continue
    if (!e2eTestNamePattern.test(candidate.name)) continue
    if (e2eCleanupEntityIsStale(candidate, now)) {
      push(candidate)
      continue
    }
    if (input.outcome !== "success") continue
    if (input.runId !== undefined && e2eCleanupEntityIsCurrentRun(candidate, input.runId)) {
      push(candidate)
      continue
    }
    if (input.currentRunIds.has(candidate.id)) push(candidate)
  }
  return { organizations, projects, users }
}

function e2eCleanupCandidateCreatedAtGet(entity: {
  readonly createdAt: number | string | undefined
}): number | undefined {
  if (typeof entity.createdAt === "number") return entity.createdAt
  if (typeof entity.createdAt === "string") {
    const time = new Date(entity.createdAt).getTime()
    return Number.isNaN(time) ? undefined : time
  }
  return undefined
}

function e2eCleanupEntityIsStale(entity: E2eCleanupCandidate, now: Date): boolean {
  const named = e2eTestNameCreatedAtParse(entity.name)
  if (!named.success) return false
  if (now.getTime() - named.data.getTime() < staleAfterMs) return false
  if (entity.createdAt === undefined) return true
  return now.getTime() - entity.createdAt >= staleAfterMs
}

function e2eCleanupEntityIsCurrentRun(entity: E2eCleanupCandidate, runId: string): boolean {
  const suffix = entity.name.slice("e2e-aw-".length)
  return suffix.startsWith(`${runId}-`)
}
