import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { createResult, createResultError, type Result } from "#result"

export type E2eRunLock = {
  readonly pid: number
  readonly startedAt: string
}

/**
 * Claims the per-target orchestrator lock. A second concurrent run for the same
 * target is refused while the recorded owner process is alive; a lock whose
 * owner is dead (or whose content is unreadable) is treated as stale, removed,
 * and replaced. The write uses `wx` so two racers cannot both succeed.
 */
export function e2eRunLockAcquire(lockPath: string): Result<E2eRunLock> {
  const op = "e2eRunLockAcquire"
  if (lockPath.length === 0) return createResultError(op, "The E2E run lock path is required.")
  try {
    mkdirSync(dirname(lockPath), { recursive: true })
  } catch {
    return createResultError(op, `Cannot create the E2E run lock directory at ${dirname(lockPath)}.`)
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existing = e2eRunLockRead(lockPath)
    if (existing === undefined && attempt > 0 && e2eRunLockUnreadableExists(lockPath))
      return e2eRunLockCorruptReplace(op, lockPath)
    if (existing !== undefined) {
      if (e2eRunLockOwnerAlive(existing.pid))
        return createResultError(
          op,
          `Another E2E run is already in progress (pid ${existing.pid}, started ${existing.startedAt}). ` +
            "Wait for it to finish before starting a new run.",
        )
      try {
        rmSync(lockPath, { force: true })
      } catch {
        return createResultError(op, `Cannot remove the stale E2E run lock at ${lockPath}.`)
      }
    }
    const lock: E2eRunLock = { pid: process.pid, startedAt: new Date().toISOString() }
    try {
      writeFileSync(lockPath, `${JSON.stringify(lock)}\n`, { flag: "wx", mode: 0o600 })
      return createResult(lock)
    } catch (error) {
      if (attempt === 0 && e2eRunLockExistsErrorIs(error)) continue
      return createResultError(op, `Cannot write the E2E run lock at ${lockPath}.`)
    }
  }
  return createResultError(op, `Cannot acquire the E2E run lock at ${lockPath}.`)
}

export function e2eRunLockRelease(lockPath: string): void {
  try {
    const raw = readFileSync(lockPath, "utf8")
    const parsed = JSON.parse(raw) as { pid?: unknown }
    if (parsed.pid !== process.pid) return
  } catch {
    return
  }
  try {
    rmSync(lockPath, { force: true })
  } catch {
    // Best effort: a leftover lock is reclaimed as stale by the next run.
  }
}

function e2eRunLockRead(lockPath: string): E2eRunLock | undefined {
  let raw: string
  try {
    raw = readFileSync(lockPath, "utf8")
  } catch {
    return undefined
  }
  try {
    const parsed = JSON.parse(raw) as { pid?: unknown; startedAt?: unknown }
    if (typeof parsed.pid !== "number" || !Number.isSafeInteger(parsed.pid) || parsed.pid <= 0) return undefined
    if (typeof parsed.startedAt !== "string" || parsed.startedAt.length === 0) return undefined
    return { pid: parsed.pid, startedAt: parsed.startedAt }
  } catch {
    return undefined
  }
}

function e2eRunLockUnreadableExists(lockPath: string): boolean {
  try {
    readFileSync(lockPath, "utf8")
    return true
  } catch {
    return false
  }
}

function e2eRunLockCorruptReplace(op: string, lockPath: string): Result<E2eRunLock> {
  try {
    rmSync(lockPath, { force: true })
  } catch {
    return createResultError(op, `Cannot remove the corrupt E2E run lock at ${lockPath}.`)
  }
  const lock: E2eRunLock = { pid: process.pid, startedAt: new Date().toISOString() }
  try {
    writeFileSync(lockPath, `${JSON.stringify(lock)}\n`, { flag: "wx", mode: 0o600 })
    return createResult(lock)
  } catch {
    return createResultError(op, `Cannot write the E2E run lock at ${lockPath}.`)
  }
}

function e2eRunLockOwnerAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function e2eRunLockExistsErrorIs(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST"
}
