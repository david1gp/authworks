import type { Page } from "@playwright/test"
import { e2eCheckpointActivePathGet } from "../../harness/e2eCheckpointActivePathGet.js"
import { e2eCheckpointRead } from "../../harness/e2eCheckpointRead.js"
import type { E2eCheckpoint, E2eCheckpointEntity } from "../../harness/e2eCheckpointSchema.js"
import { e2eCheckpointWrite } from "../../harness/e2eCheckpointWrite.js"
import { e2eServiceCredentialsRequire } from "../../harness/e2eCredentialsResolve.js"
import { e2eEntityRecord } from "../../harness/e2eEntityRecord.js"
import { e2eTargetBaseUrlGet } from "../../harness/e2eTargetBaseUrlGet.js"
import { e2eWorkflowApiClientCreate } from "./e2eWorkflowApiClientCreate.js"

export type E2eWorkflowContext = {
  readonly api: ReturnType<typeof e2eWorkflowApiClientCreate>
  readonly baseUrl: string
  readonly checkpointPath: string
  readonly organizationDomain: string
  readonly page: Page
  readonly runId: string
  readonly servicePassword: string
  readonly serviceUsername: string
}

export function e2eWorkflowContextCreate(page: Page): E2eWorkflowContext {
  const checkpointPath = e2eCheckpointActivePathGet()
  if (checkpointPath === undefined)
    throw new Error("e2eWorkflowContext: AUTHWORKS_E2E_CHECKPOINT_PATH is not set (run through scripts/e2eRun.ts).")
  const read = e2eCheckpointRead(checkpointPath)
  if (!read.success) throw new Error(read.errorMessage)
  if ("absent" in read.data) throw new Error(`e2eWorkflowContext: no E2E checkpoint at ${checkpointPath}.`)
  const runId = process.env.AUTHWORKS_E2E_RUN_ID ?? read.data.checkpoint.runId
  if (runId.length === 0) throw new Error("e2eWorkflowContext: AUTHWORKS_E2E_RUN_ID is not set.")
  const credentials = e2eServiceCredentialsRequire()
  const baseUrl = process.env.AUTHWORKS_E2E_BASE_URL ?? e2eTargetBaseUrlGet()
  const domain = new URL(baseUrl).hostname
  return {
    api: e2eWorkflowApiClientCreate({ baseUrl }),
    baseUrl,
    checkpointPath,
    organizationDomain: domain,
    page,
    runId,
    servicePassword: credentials.password,
    serviceUsername: credentials.username,
  }
}

export function e2eWorkflowEntityRecord(checkpointPath: string, entity: E2eCheckpointEntity): E2eCheckpoint {
  const recorded = e2eEntityRecord(checkpointPath, entity)
  if (!recorded.success) throw new Error(recorded.errorMessage)
  return recorded.data
}

export function e2eWorkflowValueSet(checkpointPath: string, key: string, value: string): E2eCheckpoint {
  const read = e2eCheckpointRead(checkpointPath)
  if (!read.success) throw new Error(read.errorMessage)
  if ("absent" in read.data) throw new Error(`e2eWorkflowContext: no E2E checkpoint at ${checkpointPath}.`)
  const updated: E2eCheckpoint = {
    ...read.data.checkpoint,
    values: { ...read.data.checkpoint.values, [key]: value },
  }
  const written = e2eCheckpointWrite(checkpointPath, updated)
  if (!written.success) throw new Error(written.errorMessage)
  return updated
}

export function e2eWorkflowValueGet(checkpointPath: string, key: string): string | undefined {
  const read = e2eCheckpointRead(checkpointPath)
  if (!read.success) throw new Error(read.errorMessage)
  if ("absent" in read.data) throw new Error(`e2eWorkflowContext: no E2E checkpoint at ${checkpointPath}.`)
  return read.data.checkpoint.values[key]
}
