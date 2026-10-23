import { join } from "node:path"
import type { E2eTarget } from "./e2eTargetSchema.js"

export function e2eCheckpointPathGet(stateDir: string, target: E2eTarget): string {
  return join(stateDir, target, "checkpoint.json")
}
