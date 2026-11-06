import { mdiLogout } from "@adaptive-ds/mdi/mdiLogout.js"
import { A } from "@solidjs/router"
import { Show } from "solid-js"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { AuthenticatedRelativeTime } from "../../../ui/authenticated/AuthenticatedRelativeTime.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ImpersonationAdminBanner } from "./ImpersonationAdminBanner.js"
import { ImpersonationAdminStartForm } from "./ImpersonationAdminStartForm.js"
import { ImpersonationAdminStateBoundary } from "./ImpersonationAdminStateBoundary.js"
import type { ImpersonationAdminPageState } from "./impersonationAdminPageStateCreate.js"
import { impersonationAdminRemainingFormat } from "./impersonationAdminRemainingFormat.js"

/** The single stateless view shared by the production and demo impersonation adapters. */
export function ImpersonationAdminView(props: {
  readonly basePath: string
  readonly state: ImpersonationAdminPageState
}) {
  const state = props.state
  return (
    <section aria-label={messageTranslate("admin.impersonation.title")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <AuthenticatedPageHeader
        title={messageTranslate("admin.impersonation.title")}
        description={messageTranslate("admin.impersonation.description")}
      />
      {/* The banner stays visible in every guarded state, so an active session is never hidden. */}
      <Show when={state.active()}>
        {(session) => (
          <ImpersonationAdminBanner
            eventsHref={state.eventsHref(props.basePath)}
            onEnd={() => void state.impersonationEnd()}
            pending={state.pendingId() !== undefined}
            remainingSeconds={state.remainingSeconds()}
            session={session()}
          />
        )}
      </Show>

      <Show when={state.notice()}>{(notice) => <AuthenticatedNotice message={notice()} />}</Show>

      <ImpersonationAdminStateBoundary error={state.error()} onRetry={state.reload} status={state.status()}>
        <Show when={state.active()} fallback={<ImpersonationAdminStartSection state={state} />}>
          {(session) => (
            <AuthenticatedSection
              actions={
                <>
                  <A class="text-xs font-medium text-accent hover:underline" href={state.eventsHref(props.basePath)}>
                    {messageTranslate("admin.impersonation.auditLink")}
                  </A>
                  <AuthenticatedButton
                    size="sm"
                    disabled={state.pendingId() !== undefined}
                    icon={mdiLogout}
                    onClick={() => void state.impersonationEnd()}
                    variant="outlineRed"
                  >
                    {messageTranslate("admin.impersonation.end")}
                  </AuthenticatedButton>
                </>
              }
              padded
              title={messageTranslate("admin.impersonation.activeTitle")}
            >
              <AuthenticatedFieldList
                columns={3}
                fields={[
                  { label: messageTranslate("admin.impersonation.actor"), value: session().actorLabel },
                  { label: messageTranslate("admin.impersonation.subject"), value: session().subjectLabel },
                  {
                    label: messageTranslate("admin.impersonation.remaining"),
                    value: impersonationAdminRemainingFormat(state.remainingSeconds()),
                  },
                  {
                    label: messageTranslate("admin.impersonation.startedAt"),
                    value: <AuthenticatedRelativeTime value={session().startedAt} />,
                  },
                  {
                    label: messageTranslate("admin.impersonation.expires"),
                    value: <AuthenticatedRelativeTime value={session().expiresAt} />,
                  },
                  { label: messageTranslate("admin.impersonation.reason"), value: session().reason ?? "" },
                ]}
              />
            </AuthenticatedSection>
          )}
        </Show>
      </ImpersonationAdminStateBoundary>
    </section>
  )
}

function ImpersonationAdminStartSection(props: { readonly state: ImpersonationAdminPageState }) {
  return (
    <AuthenticatedSection title={messageTranslate("admin.impersonation.start")}>
      <div class="px-4 py-3">
        <ImpersonationAdminStartForm state={props.state} />
      </div>
    </AuthenticatedSection>
  )
}
