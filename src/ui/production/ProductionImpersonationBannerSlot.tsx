import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { ImpersonationAdminBanner } from "../../features/impersonation/ui/ImpersonationAdminBanner.js"
import { impersonationAdminShellBannerStateCreate } from "../../features/impersonation/ui/impersonationAdminShellBannerStateCreate.js"
import { ttc } from "../i18n/model/ttc.js"
import { productionSessionContextGet } from "./productionSessionContextGet.js"

/**
 * Mounts the persistent impersonation banner above every authenticated shell. The resolved
 * session is preferred; the shell session context remains a static fallback so the banner is
 * still announced when no browser contract is reachable.
 */
export function ProductionImpersonationBannerSlot(props: { readonly children?: JSX.Element }) {
  const session = productionSessionContextGet()
  const state = impersonationAdminShellBannerStateCreate()
  return (
    <Show when={props.children} fallback={<ProductionImpersonationBannerResolved session={session} state={state} />}>
      {props.children}
    </Show>
  )
}

function ProductionImpersonationBannerResolved(props: {
  readonly session: ReturnType<typeof productionSessionContextGet>
  readonly state: ReturnType<typeof impersonationAdminShellBannerStateCreate>
}) {
  return (
    <Show
      when={props.state.active()}
      fallback={
        <Show when={props.session.impersonation}>
          {(impersonation) => (
            <aside
              aria-label={ttc("Impersonation in progress")}
              class="border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-50"
              data-impersonation-banner
              role="region"
            >
              {ttc("{actor} is acting as {subject}.", {
                actor: impersonation().actorLabel,
                subject: impersonation().subjectLabel,
              })}
            </aside>
          )}
        </Show>
      }
    >
      {(session) => (
        <ImpersonationAdminBanner
          eventsHref={`/admin/events?q=${encodeURIComponent(session().sessionId)}`}
          onEnd={() => void props.state.end()}
          pending={props.state.pending()}
          remainingSeconds={props.state.remainingSeconds()}
          session={session()}
        />
      )}
    </Show>
  )
}
