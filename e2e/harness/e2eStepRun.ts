import { createResult, createResultError, type Result } from "#result"
import { e2eCheckpointActivePathGet } from "./e2eCheckpointActivePathGet.js"
import { e2eCheckpointRead } from "./e2eCheckpointRead.js"
import type { E2eCheckpoint } from "./e2eCheckpointSchema.js"
import { e2eCheckpointWrite } from "./e2eCheckpointWrite.js"

export type E2eStepRunner = {
  readonly checkpoint: () => E2eCheckpoint | undefined
  readonly run: (stepName: string, run: () => Promise<void>) => Promise<void>
}

type E2eStepRunInput = {
  readonly checkpointPath?: string
  /** Workflow owning the step; recorded steps are namespaced so shared names never collide across workflows. */
  readonly namespace?: string
  readonly stepName: string
  readonly step: (title: string, body: () => Promise<void>) => Promise<void>
  readonly run: () => Promise<void>
}

type E2eStepRunEnvironment = Readonly<Record<string, string | undefined>>

export function e2eStepRunCreate(
  path: string,
  step: (title: string, body: () => Promise<void>) => Promise<void>,
  environment: E2eStepRunEnvironment = process.env,
  namespace?: string,
): E2eStepRunner {
  const op = "e2eStepRun"
  const activePath = path
  let checkpoint: E2eCheckpoint | undefined
  const checkpointEnsure = (): Result<E2eCheckpoint> => {
    if (checkpoint !== undefined) return createResult(checkpoint)
    const read = e2eCheckpointRead(activePath)
    if (!read.success) return read
    if ("absent" in read.data) return createResultError(op, `No E2E checkpoint at ${activePath} (${read.data.reason}).`)
    checkpoint = read.data.checkpoint
    return createResult(checkpoint)
  }
  return {
    checkpoint: () => checkpoint,
    run: async (stepName, run) => {
      const key = namespace === undefined || namespace === "" ? stepName : `${namespace}/${stepName}`
      const ensured = checkpointEnsure()
      if (!ensured.success) throw new Error(ensured.errorMessage)
      if (ensured.data.completedSteps.includes(key)) {
        process.stderr.write(`E2E step "${key}" already completed; skipping.\n`)
        return
      }
      await step(stepName, run)
      const reread = e2eCheckpointRead(activePath)
      if (!reread.success) throw new Error(reread.errorMessage)
      if ("absent" in reread.data) throw new Error(`${op}: no E2E checkpoint at ${activePath} (${reread.data.reason}).`)
      const fresh = reread.data.checkpoint
      const completedSteps = fresh.completedSteps.includes(key) ? fresh.completedSteps : [...fresh.completedSteps, key]
      const updated: E2eCheckpoint = { ...fresh, completedSteps }
      const written = e2eCheckpointWrite(activePath, updated)
      if (!written.success) throw new Error(written.errorMessage)
      checkpoint = updated
      const faultAfterStep = environment.AUTHWORKS_E2E_FAIL_AFTER_STEP
      if (faultAfterStep !== undefined && (faultAfterStep === stepName || faultAfterStep === key))
        throw new Error(`Injected E2E failure after step "${key}" (AUTHWORKS_E2E_FAIL_AFTER_STEP).`)
    },
  }
}

export async function e2eStepRun(input: E2eStepRunInput): Promise<void> {
  const op = "e2eStepRun"
  const activePath = input.checkpointPath ?? e2eCheckpointActivePathGet()
  if (activePath === undefined)
    throw new Error(`${op}: no checkpoint path (pass checkpointPath or set AUTHWORKS_E2E_CHECKPOINT_PATH).`)
  const runner = e2eStepRunCreate(activePath, input.step, process.env, input.namespace)
  await runner.run(input.stepName, input.run)
}
