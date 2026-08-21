import { createEffect, createSignal, on, onCleanup } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import { impersonationAdminProductionAdapterCreate } from "./impersonationAdminProductionAdapterCreate.js"
import type { ImpersonationAdminSession } from "./impersonationAdminAdapter.js"

/**
 * The minimal state behind the persistent shell banner. It only resolves whether the current
 * browser session is impersonated and offers the explicit end action; it never reads or holds
 * a session credential, and it renders nothing when there is no impersonation.
 */
export function impersonationAdminShellBannerStateCreate() {
  const session = productionSessionContextGet()
  const realmId = () => {
    const realm = session.guard.realm
    return typeof realm === "object" ? realm.realmId : ""
  }
  const adapter = impersonationAdminProductionAdapterCreate({
    baseUrl: typeof window === "undefined" ? "http://localhost" : window.location.origin,
    realmId,
  })
  const active = createSignalObject<ImpersonationAdminSession | null>(null)
  const pending = createSignalObject(false)
  const [now, nowSet] = createSignal(Date.now())

  createEffect(
    on(realmId, async (realm) => {
      if (realm.length === 0) return active.set(null)
      const result = await adapter.activeGet()
      // A failed probe simply means no banner; it must never block the surrounding page.
      active.set(result.success ? result.data : null)
    }),
  )

  // The countdown is only ticked while an impersonation is actually active.
  createEffect(() => {
    if (active.get() === null) return
    const timer = setInterval(() => nowSet(Date.now()), 1_000)
    onCleanup(() => clearInterval(timer))
  })

  return {
    active: active.get,
    end: async () => {
      const current = active.get()
      if (current === null) return
      pending.set(true)
      const result = await adapter.impersonationEnd(current.sessionId)
      pending.set(false)
      if (!result.success) return
      active.set(null)
    },
    pending: pending.get,
    remainingSeconds: () => {
      const current = active.get()
      if (current === null) return 0
      return Math.max(0, Math.floor((current.expiresAt - now()) / 1_000))
    },
  }
}
