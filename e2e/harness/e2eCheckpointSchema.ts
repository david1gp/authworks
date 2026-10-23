import * as v from "valibot"
import { e2eTargetSchema } from "./e2eTargetSchema.js"

const e2eCheckpointEntitySchema = v.object({
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  id: v.string(),
  kind: v.picklist(["user", "organization", "project", "membership", "assignment"]),
  name: v.string(),
})

export const e2eCheckpointSchema = v.object({
  baseUrl: v.string(),
  completedSteps: v.array(v.string()),
  completedSuites: v.array(v.string()),
  entities: v.array(e2eCheckpointEntitySchema),
  runId: v.string(),
  startedAt: v.pipe(v.string(), v.isoTimestamp()),
  target: e2eTargetSchema,
  values: v.record(v.string(), v.string()),
  version: v.literal(1),
})

export type E2eCheckpoint = v.InferOutput<typeof e2eCheckpointSchema>
export type E2eCheckpointEntity = v.InferOutput<typeof e2eCheckpointEntitySchema>
