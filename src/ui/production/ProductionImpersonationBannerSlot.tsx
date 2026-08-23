import { Show } from "solid-js"
import { ImpersonationAdminBanner } from "../../features/impersonation/ui/ImpersonationAdminBanner.js"
import { impersonationAdminShellBannerStateCreate } from "../../features/impersonation/ui/impersonationAdminShellBannerStateCreate.js"
import { ConfirmDialog } from "../confirm/ConfirmDialog.js"
import { confirmStateCreate } from "../confirm/confirmStateCreate.js"

/** Mounts the persistent impersonation banner and end action above every authenticated shell. */
export function ProductionImpersonationBannerSlot() {
  const confirmState = confirmStateCreate()
  const state = impersonationAdminShellBannerStateCreate({ confirm: confirmState.confirm })
  return (
    <>
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
      <ConfirmDialog state={confirmState} titleKey="admin.common.confirmTitle" />
    </>
  )
}
