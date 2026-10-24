import { e2eCheckpointIsStale } from "./e2eCheckpointIsStale.js"
import type { E2eCheckpoint } from "./e2eCheckpointSchema.js"
import type { E2eTarget } from "./e2eTargetSchema.js"

export type E2eRunResumeDecision = "new" | "resume" | "stale"

type E2eRunResumeDecideInput = {
  readonly baseUrl: string
  readonly checkpoint: E2eCheckpoint | undefined
  readonly now?: Date
  readonly target: E2eTarget
}

export function e2eRunResumeDecide(input: E2eRunResumeDecideInput): E2eRunResumeDecision {
  const checkpoint = input.checkpoint
  if (checkpoint === undefined) return "new"
  if (checkpoint.target !== input.target || checkpoint.baseUrl !== input.baseUrl) return "new"
  if (e2eCheckpointIsStale(checkpoint, input.now ?? new Date())) return "stale"
  return "resume"
}
