import { isServer } from "@solidjs/web"
import { createEffect, createStore, type Store, type StoreSetter } from "solid-js"

export function createLocalStore<T extends object>(initState: T, storageKey: string): [Store<T>, StoreSetter<T>] {
  const initial = isServer ? initState : restoreLocalStore(initState, storageKey)
  const [state, setState] = createStore<T>(initial as T extends Function ? never : T)
  if (!isServer) {
    createEffect(
      () => JSON.stringify(state),
      (value) => {
        try {
          localStorage.setItem(storageKey, value)
        } catch {
          // Storage may be disabled or over quota. The in-memory store still works.
        }
      },
    )
  }
  return [state, setState]
}

function restoreLocalStore<T extends object>(defaults: T, key: string): T {
  try {
    const value = localStorage.getItem(key)
    if (value === null) return defaults
    const stored: unknown = JSON.parse(value)
    if (typeof stored !== "object" || stored === null) return defaults
    if (Array.isArray(defaults)) return (Array.isArray(stored) ? stored : defaults) as T
    if (Array.isArray(stored)) return defaults
    return { ...defaults, ...stored }
  } catch {
    return defaults
  }
}
