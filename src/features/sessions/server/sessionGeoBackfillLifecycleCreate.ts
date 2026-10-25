import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { sessionGeoBackfill } from "../actions/sessionGeoBackfill.js"
import type { SessionGeoLookupPort } from "../domain/sessionGeoLookupPort.js"

const sessionGeoBackfillDefaultIntervalMs = 5 * 60 * 1_000
type SessionGeoBackfillTimer = number | { readonly unref?: () => void }

type SessionGeoBackfillLifecycleCreateOptions = {
  readonly clearInterval?: (timer: SessionGeoBackfillTimer) => void
  readonly database: StorageDatabase
  readonly intervalMs?: number
  readonly limit?: number
  readonly log?: (message: string) => void
  readonly lookup: SessionGeoLookupPort
  readonly setInterval?: (handler: () => void, timeout: number) => SessionGeoBackfillTimer
}

/** Periodically fills session country and region without touching request handling. */
export function sessionGeoBackfillLifecycleCreate(options: SessionGeoBackfillLifecycleCreateOptions) {
  const setIntervalFn = options.setInterval ?? globalThis.setInterval
  const clearIntervalFn =
    options.clearInterval ?? ((timer: SessionGeoBackfillTimer) => globalThis.clearInterval(timer as number))
  const log = options.log ?? ((message: string) => console.error(message))
  const logFailure = (message: string): void => {
    try {
      log(message)
    } catch (_error) {
      // Geo logging must not turn a backfill failure into an unhandled rejection.
    }
  }
  let drainInFlight: Promise<Result<void>> | undefined
  let started = false
  let stopped = false
  let timer: SessionGeoBackfillTimer | undefined

  return {
    start(): Promise<Result<void>> {
      if (started || stopped) return Promise.resolve(resultCreate(undefined))
      started = true
      timer = setIntervalFn(() => {
        if (!stopped) void drainStart()
      }, options.intervalMs ?? sessionGeoBackfillDefaultIntervalMs)
      timerUnref(timer)
      return drainStart()
    },
    stop(): void {
      if (stopped) return
      stopped = true
      if (timer === undefined) return
      clearIntervalFn(timer)
      timer = undefined
    },
  }

  function drainStart(): Promise<Result<void>> {
    if (drainInFlight !== undefined) return drainInFlight
    const operation = drainRun()
    drainInFlight = operation
    void operation.then(
      () => {
        if (drainInFlight === operation) drainInFlight = undefined
      },
      () => {
        if (drainInFlight === operation) drainInFlight = undefined
      },
    )
    return operation
  }

  async function drainRun(): Promise<Result<void>> {
    try {
      const backfilled = await sessionGeoBackfill({
        database: options.database,
        ...(options.limit === undefined ? {} : { limit: options.limit }),
        lookup: options.lookup,
      })
      if (!backfilled.success) logFailure(backfilled.errorMessage)
      return backfilled.success ? resultCreate(undefined) : resultErrorCreate(backfilled.op, backfilled.errorMessage)
    } catch (_error) {
      logFailure("The session geo backfill failed.")
      return resultErrorCreate("sessionGeoBackfill", "The session geo backfill failed.")
    }
  }
}

function timerUnref(timer: SessionGeoBackfillTimer): void {
  if (typeof timer !== "object" || timer === null || !("unref" in timer)) return
  const unref = timer.unref
  if (typeof unref === "function") unref.call(timer)
}
