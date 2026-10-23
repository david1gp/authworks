import { chmodSync, mkdirSync, renameSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { createResult, createResultError, type Result } from "#result"
import type { E2eCheckpoint } from "./e2eCheckpointSchema.js"

export function e2eCheckpointWrite(path: string, checkpoint: E2eCheckpoint): Result<void> {
  const op = "e2eCheckpointWrite"
  try {
    mkdirSync(dirname(path), { recursive: true })
    const temporary = `${path}.${process.pid}.tmp`
    writeFileSync(temporary, JSON.stringify(checkpoint, null, 2), { encoding: "utf8", mode: 0o600 })
    chmodSync(temporary, 0o600)
    renameSync(temporary, path)
    return createResult(undefined)
  } catch {
    return createResultError(op, `Cannot write the E2E checkpoint at ${path}.`)
  }
}
