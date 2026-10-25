import { existsSync, readdirSync, rmSync, statSync } from "node:fs"
import { join } from "node:path"

const staleAfterMs = 24 * 60 * 60 * 1000

type E2eCleanupStaleStateRemoveOptions = {
  /** Skip the dev directory when the dev server is alive; its credentials, pid file, and database are live. */
  readonly devServerRunning?: boolean
}

/**
 * Deletes state files older than 24h under each target state directory, except
 * `checkpoint.json` and `artifacts` (handled separately). The dev directory is
 * skipped while the dev server is alive: deleting its credentials, pid file, or
 * database would orphan the running server, which authenticates with the stored
 * system secret.
 */
export function e2eCleanupStaleStateRemove(
  stateDir: string,
  now: Date,
  options?: E2eCleanupStaleStateRemoveOptions,
): void {
  for (const target of ["dev", "production"] as const) {
    if (target === "dev" && options?.devServerRunning === true) continue
    const targetDir = join(stateDir, target)
    if (!existsSync(targetDir)) continue
    let entries: string[]
    try {
      entries = readdirSync(targetDir)
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry === "checkpoint.json" || entry === "artifacts") continue
      const path = join(targetDir, entry)
      try {
        if (now.getTime() - statSync(path).mtimeMs >= staleAfterMs) rmSync(path, { force: true, recursive: true })
      } catch {
        // Best effort: stale state removal must not fail the cleanup.
      }
    }
    const artifactsDir = join(targetDir, "artifacts")
    if (!existsSync(artifactsDir)) continue
    let artifacts: string[]
    try {
      artifacts = readdirSync(artifactsDir)
    } catch {
      continue
    }
    for (const entry of artifacts) {
      const path = join(artifactsDir, entry)
      try {
        if (now.getTime() - statSync(path).mtimeMs >= staleAfterMs) rmSync(path, { force: true, recursive: true })
      } catch {
        // Best effort: stale state removal must not fail the cleanup.
      }
    }
  }
}
