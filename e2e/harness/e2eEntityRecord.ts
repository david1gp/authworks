import { createResult, createResultError, type Result } from "#result"
import { e2eCheckpointRead } from "./e2eCheckpointRead.js"
import type { E2eCheckpoint, E2eCheckpointEntity } from "./e2eCheckpointSchema.js"
import { e2eCheckpointWrite } from "./e2eCheckpointWrite.js"

export function e2eEntityRecord(path: string, entity: E2eCheckpointEntity): Result<E2eCheckpoint> {
  const op = "e2eEntityRecord"
  const read = e2eCheckpointRead(path)
  if (!read.success) return read
  if ("absent" in read.data) return createResultError(op, `No E2E checkpoint at ${path} (${read.data.reason}).`)
  const current = read.data.checkpoint
  const entities = current.entities.some((entry) => entry.kind === entity.kind && entry.id === entity.id)
    ? current.entities
    : [...current.entities, entity]
  const updated: E2eCheckpoint = { ...current, entities }
  const written = e2eCheckpointWrite(path, updated)
  if (!written.success) return written
  return createResult(updated)
}
