import { createEffect, createSignal, on, onCleanup } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { productionRealmIdResolve } from "../../../ui/production/productionRealmIdResolve.js"
import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import type { ImpersonationAdminSession } from "./impersonationAdminAdapter.js"
import { impersonationAdminProductionAdapterCreate } from "./impersonationAdminProductionAdapterCreate.js"

/**
 * The minimal state behind the persistent shell banner. It only resolves whether the current
 * browser session is impersonated and offers the explicit end action; it never reads or holds
 * a session credential, and it renders nothing when there is no impersonation.
 */
export function impersonationAdminShellBannerStateCreate(options: {
  readonly confirm: (message: string) => boolean | Promise<boolean>
}) {
  const confirmAction = options.confirm
  const session = productionSessionContextGet()
  const fallbackRealmId = () => {
    const realm = session.guard.realm
    return typeof realm === "object" ? realm.realmId : ""
  }
  const baseUrl = typeof window === "undefined" ? "http://localhost" : window.location.origin
  const realmId = createSignalObject(fallbackRealmId())
  createEffect(() => {
    void productionRealmIdResolve({
      baseUrl,
      domain: typeof window === "undefined" ? "localhost" : window.location.host,
      fallbackRealmId: fallbackRealmId(),
    }).then(realmId.set)
  })
  const adapter = impersonationAdminProductionAdapterCreate({
    baseUrl,
    realmId: realmId.get,
  })
  const active = createSignalObject<ImpersonationAdminSession | null>(null)
  const pending = createSignalObject(false)
  const [now, nowSet] = createSignal(Date.now())

  createEffect(
    on(realmId.get, async (realm) => {
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
      // Ending impersonation is destructive for the current browser session, so it is confirmed.
      const confirmed = await confirmAction(
        messageTranslate("admin.impersonation.endConfirm", { subject: current.subjectLabel }),
      )
      if (confirmed !== true) return
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
