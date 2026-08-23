const storageKey = "authworks.machine-users.acknowledged-secrets"

/**
 * Overrides the session storage used for acknowledgement. Tests inject a real storage
 * implementation here instead of installing a global `window`, which would otherwise make
 * unrelated modules treat the process as a browser.
 */
let storageOverride: Storage | undefined

const sessionStorageGet = (): Storage | undefined => {
  if (storageOverride !== undefined) return storageOverride
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage
  } catch {
    // A blocked storage partition must not break the screen; acknowledgement then stays in memory.
    return undefined
  }
}

const memory = new Set<string>()

const readAll = (): ReadonlySet<string> => {
  const storage = sessionStorageGet()
  if (storage === undefined) return memory
  try {
    const parsed: unknown = JSON.parse(storage.getItem(storageKey) ?? "[]")
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [])
  } catch {
    return memory
  }
}

/**
 * Remembers, for the current browser session only, which one-time machine-user secrets have
 * already been acknowledged. Only a marker derived from the machine user and the credential
 * kind is stored: the secret value itself is never persisted, logged, or placed in a URL.
 */
export const machineAdminSecretAcknowledgementStore = {
  acknowledged: (marker: string) => readAll().has(marker),
  acknowledge: (marker: string) => {
    memory.add(marker)
    const storage = sessionStorageGet()
    if (storage === undefined) return
    try {
      storage.setItem(storageKey, JSON.stringify([...readAll(), marker]))
    } catch {
      // Storage quota or a private mode denial leaves the in-memory marker in place.
    }
  },
  /** A stable marker for a one-time secret that contains no secret material. */
  markerBuild: (machineUserId: string, kind: string) => `${machineUserId}:${kind}`,
  /** Test-only seam for exercising acknowledgement against a real storage implementation. */
  storageSet: (storage: Storage | undefined) => {
    storageOverride = storage
    memory.clear()
  },
}
