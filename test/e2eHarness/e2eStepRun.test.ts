import { expect, test } from "bun:test"
import { e2eCheckpointPathGet } from "../../e2e/harness/e2eCheckpointPathGet.js"
import { e2eCheckpointRead } from "../../e2e/harness/e2eCheckpointRead.js"
import type { E2eCheckpoint } from "../../e2e/harness/e2eCheckpointSchema.js"
import { e2eCheckpointWrite } from "../../e2e/harness/e2eCheckpointWrite.js"
import { e2eEntityRecord } from "../../e2e/harness/e2eEntityRecord.js"
import { e2eStepRunCreate } from "../../e2e/harness/e2eStepRun.js"
import { e2eWorkflowValueSet } from "../../e2e/workflows/shared/e2eWorkflowContextCreate.js"

test("e2e step runs keep the entities and values the step body recorded", async () => {
  const directory = await e2eStepRunTemporaryDirCreate()
  const path = e2eCheckpointPathGet(directory, "dev")
  expect(e2eCheckpointWrite(path, e2eStepRunCheckpointCreate()).success).toBe(true)
  const runner = e2eStepRunCreate(path, e2eStepRunPassThrough, {})
  await runner.run("setup", async () => {
    const recorded = e2eEntityRecord(path, e2eStepRunOwnerCreate())
    expect(recorded.success).toBe(true)
    e2eWorkflowValueSet(path, "ownerId", "user-1")
  })
  const persisted = e2eCheckpointRead(path)
  expect(persisted.success).toBe(true)
  if (persisted.success && "checkpoint" in persisted.data) {
    expect(persisted.data.checkpoint.completedSteps).toEqual(["setup"])
    expect(persisted.data.checkpoint.entities).toHaveLength(1)
    expect(persisted.data.checkpoint.values).toEqual({ ownerId: "user-1" })
  }
})

test("e2e step runs persist the step and its body writes before the injected failure", async () => {
  const directory = await e2eStepRunTemporaryDirCreate()
  const path = e2eCheckpointPathGet(directory, "dev")
  expect(e2eCheckpointWrite(path, e2eStepRunCheckpointCreate()).success).toBe(true)
  const runner = e2eStepRunCreate(path, e2eStepRunPassThrough, { AUTHWORKS_E2E_FAIL_AFTER_STEP: "setup" })
  await expect(
    runner.run("setup", async () => {
      const recorded = e2eEntityRecord(path, e2eStepRunOwnerCreate())
      expect(recorded.success).toBe(true)
      e2eWorkflowValueSet(path, "ownerId", "user-1")
    }),
  ).rejects.toThrow("Injected E2E failure")
  const persisted = e2eCheckpointRead(path)
  expect(persisted.success).toBe(true)
  if (persisted.success && "checkpoint" in persisted.data) {
    expect(persisted.data.checkpoint.completedSteps).toEqual(["setup"])
    expect(persisted.data.checkpoint.entities).toHaveLength(1)
    expect(persisted.data.checkpoint.values).toEqual({ ownerId: "user-1" })
  }
  let executed = 0
  await runner.run("setup", async () => {
    executed += 1
  })
  expect(executed).toBe(0)
})

function e2eStepRunCheckpointCreate(): E2eCheckpoint {
  return {
    baseUrl: "http://127.0.0.1:5190",
    completedSteps: [],
    completedSuites: [],
    entities: [],
    runId: "202603040506-abcdef",
    startedAt: "2026-03-04T05:06:00.000Z",
    target: "dev",
    values: {},
    version: 1,
  }
}

function e2eStepRunOwnerCreate() {
  return {
    createdAt: "2026-03-04T05:06:00.000Z",
    id: "user-1",
    kind: "user" as const,
    name: "e2e-aw-202603040506-abcdef-owner",
  }
}

async function e2eStepRunPassThrough(_title: string, body: () => Promise<void>): Promise<void> {
  await body()
}

async function e2eStepRunTemporaryDirCreate(): Promise<string> {
  const prefix = `${process.env.TMPDIR ?? "/tmp"}/authworks-e2e-steprun-test-`
  const directory = `${prefix}${Date.now()}-${Math.random().toString(36).slice(2)}`
  const { mkdir } = await import("node:fs/promises")
  await mkdir(directory, { recursive: true })
  return directory
}
