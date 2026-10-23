import type { E2eCheckpoint } from "./e2eCheckpointSchema.js"

const checkpointStaleAfterMs = 24 * 60 * 60 * 1000

export function e2eCheckpointIsStale(checkpoint: Pick<E2eCheckpoint, "startedAt">, now: Date = new Date()): boolean {
  return now.getTime() - new Date(checkpoint.startedAt).getTime() >= checkpointStaleAfterMs
}
