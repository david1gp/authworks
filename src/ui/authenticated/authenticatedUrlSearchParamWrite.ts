const searchParamTimers = new Map<string, ReturnType<typeof setTimeout>>()

function searchParamIdleSchedule(work: () => void): void {
  const idle = (globalThis as { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number })
    .requestIdleCallback
  if (typeof idle === "function") idle.call(globalThis, work, { timeout: 400 })
  else setTimeout(work, 0)
}

/**
 * Writes one URL query parameter with `history.replaceState` so typing never grows browser
 * history. Calls are debounced (~250 ms), scheduled on the idle frame, and preserve every other
 * parameter; an empty value removes the key.
 */
export function authenticatedUrlSearchParamWrite(key: string, value: string): void {
  const pending = searchParamTimers.get(key)
  if (pending !== undefined) clearTimeout(pending)
  searchParamTimers.set(
    key,
    setTimeout(() => {
      searchParamTimers.delete(key)
      searchParamIdleSchedule(() => {
        const url = new URL(window.location.href)
        if (value.length === 0) url.searchParams.delete(key)
        else url.searchParams.set(key, value)
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
      })
    }, 250),
  )
}
