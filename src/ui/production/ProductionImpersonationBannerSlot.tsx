import { Show } from "solid-js"
import { ImpersonationAdminBanner } from "../../features/impersonation/ui/ImpersonationAdminBanner.js"
import { impersonationAdminShellBannerStateCreate } from "../../features/impersonation/ui/impersonationAdminShellBannerStateCreate.js"

/** Mounts the persistent impersonation banner and end action above every authenticated shell. */
export function ProductionImpersonationBannerSlot() {
  const state = impersonationAdminShellBannerStateCreate()
  return (
    <Show when={state.active()}>
      {(session) => (
        <ImpersonationAdminBanner
          eventsHref={`/admin/events?q=${encodeURIComponent(session().sessionId)}`}
          onEnd={() => void state.end()}
          pending={state.pending()}
          remainingSeconds={state.remainingSeconds()}
          session={session()}
        />
      )}
    </Show>
  )
}
