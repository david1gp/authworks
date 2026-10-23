import { readFileSync } from "node:fs"
import * as v from "valibot"
import { createResult, createResultError, type Result } from "#result"
import { type E2eCheckpoint, e2eCheckpointSchema } from "./e2eCheckpointSchema.js"

export type E2eCheckpointRead =
  | { readonly checkpoint: E2eCheckpoint }
  | { readonly absent: true; readonly reason: string }

export function e2eCheckpointRead(path: string): Result<E2eCheckpointRead> {
  const op = "e2eCheckpointRead"
  let raw: string
  try {
    raw = readFileSync(path, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return createResult({ absent: true as const, reason: "missing" })
    return createResultError(op, `Cannot read the E2E checkpoint at ${path}.`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    return createResult({ absent: true as const, reason: "invalid-json" })
  }
  const validated = v.safeParse(e2eCheckpointSchema, parsed)
  if (!validated.success)
    return createResult({ absent: true as const, reason: `invalid-schema: ${v.summarize(validated.issues)}` })
  return createResult({ checkpoint: validated.output })
}
