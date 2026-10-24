import { createResult, type Result } from "#result"
import type { E2eCheckpoint } from "./e2eCheckpointSchema.js"
import type { E2eTarget } from "./e2eTargetSchema.js"

export type E2eCleanupOutcome = "failure" | "interrupted" | "success"

type E2eCleanupRunInput = {
  readonly checkpoint: E2eCheckpoint | undefined
  readonly outcome: E2eCleanupOutcome
  readonly target: E2eTarget
}

export function e2eCleanupRun(input: E2eCleanupRunInput): Promise<Result<void>> {
  // TODO(task 18b): purge stale and current-run test data via the service user, verify none remain, and drop stale checkpoints and dev state.
  void input
  return Promise.resolve(createResult(undefined))
}
