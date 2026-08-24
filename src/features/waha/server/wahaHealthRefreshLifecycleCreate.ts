import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"

type WahaHealthTimer = number | ReturnType<typeof setInterval>

type WahaHealthRefreshLifecycleCreateOptions = {
  readonly clearInterval?: (timer: WahaHealthTimer) => void
  readonly intervalMs: number
  readonly refresh: () => Promise<Result<void>>
  readonly setInterval?: (handler: () => void, timeout: number) => WahaHealthTimer
}

export function wahaHealthRefreshLifecycleCreate(options: WahaHealthRefreshLifecycleCreateOptions) {
  const setIntervalFn = options.setInterval ?? globalThis.setInterval
  const clearIntervalFn = options.clearInterval ?? globalThis.clearInterval
  let started = false
  let stopped = false
  let timer: WahaHealthTimer | undefined

  return {
    async start(): Promise<Result<void>> {
      if (started || stopped) return resultCreate(undefined)
      started = true
      timer = setIntervalFn(() => {
        if (!stopped) void options.refresh()
      }, options.intervalMs)
      timerUnref(timer)
      return options.refresh()
    },
    stop(): void {
      if (stopped) return
      stopped = true
      if (timer === undefined) return
      clearIntervalFn(timer)
      timer = undefined
    },
  }
}

function timerUnref(timer: WahaHealthTimer): void {
  if (typeof timer !== "object" || timer === null || !("unref" in timer)) return
  const unref = timer.unref
  if (typeof unref === "function") unref.call(timer)
}
