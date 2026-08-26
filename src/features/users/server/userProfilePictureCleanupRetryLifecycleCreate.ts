import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { R2ObjectStorage } from "../../../platform/storage/r2/r2ObjectStorage.js"
import { userProfilePictureCleanupDrain } from "../actions/userProfilePictureCleanupDrain.js"

const profilePictureCleanupRetryIntervalMs = 30_000
type ProfilePictureCleanupTimer = number | { readonly unref?: () => void }

type UserProfilePictureCleanupRetryLifecycleCreateOptions = {
  readonly clearInterval?: (timer: ProfilePictureCleanupTimer) => void
  readonly database: StorageDatabase
  readonly intervalMs?: number
  readonly log?: (message: string) => void
  readonly publicOrigin?: string
  readonly setInterval?: (handler: () => void, timeout: number) => ProfilePictureCleanupTimer
  readonly storage: R2ObjectStorage
}

export function userProfilePictureCleanupRetryLifecycleCreate(
  options: UserProfilePictureCleanupRetryLifecycleCreateOptions,
) {
  const setIntervalFn = options.setInterval ?? globalThis.setInterval
  const clearIntervalFn =
    options.clearInterval ??
    ((cleanupTimer: ProfilePictureCleanupTimer) => globalThis.clearInterval(cleanupTimer as number))
  const log = options.log ?? ((message: string) => console.error(message))
  const logFailure = (message: string): void => {
    try {
      log(message)
    } catch (_error) {
      // Cleanup logging must not turn a retained cleanup item into an unhandled rejection.
    }
  }
  let drainInFlight: Promise<Result<void>> | undefined
  let started = false
  let stopped = false
  let timer: ProfilePictureCleanupTimer | undefined

  return {
    start(): Promise<Result<void>> {
      if (started || stopped) return Promise.resolve(resultCreate(undefined))
      started = true
      timer = setIntervalFn(() => {
        if (!stopped) void drainStart()
      }, options.intervalMs ?? profilePictureCleanupRetryIntervalMs)
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
      const drained = await userProfilePictureCleanupDrain({
        database: options.database,
        onDeleteFailure: (objectKey) => logFailure(`The user profile picture cleanup could not delete ${objectKey}.`),
        publicOrigin: options.publicOrigin,
        storage: options.storage,
      })
      if (!drained.success) logFailure(drained.errorMessage)
      return drained
    } catch (_error) {
      logFailure("The user profile picture cleanup failed.")
      return resultErrorCreate("userProfilePictureCleanupRetry", "The user profile picture cleanup failed.")
    }
  }
}

function timerUnref(timer: ProfilePictureCleanupTimer): void {
  if (typeof timer !== "object" || timer === null || !("unref" in timer)) return
  const unref = timer.unref
  if (typeof unref === "function") unref.call(timer)
}
