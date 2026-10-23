import { rmSync } from "node:fs"
import { createResult, createResultError, type Result } from "#result"

export function e2eCheckpointClear(path: string): Result<void> {
  const op = "e2eCheckpointClear"
  try {
    rmSync(path, { force: true })
    return createResult(undefined)
  } catch {
    return createResultError(op, `Cannot delete the E2E checkpoint at ${path}.`)
  }
}
