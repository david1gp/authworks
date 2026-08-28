import { A } from "@solidjs/router"
import { Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
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
                  <Button
                    disabled={state.pendingId() !== undefined}
                    onClick={() => void state.impersonationEnd()}
                    size="sm"
                    variant="filledRed"
                  >
                    {messageTranslate("admin.impersonation.end")}
                  </Button>
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
                    value: localeDateFormat(session().startedAt, { dateStyle: "medium", timeStyle: "short" }),
                  },
                  {
                    label: messageTranslate("admin.impersonation.expires"),
                    value: localeDateFormat(session().expiresAt, { dateStyle: "medium", timeStyle: "short" }),
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
    <AuthenticatedSection
      description={messageTranslate("admin.impersonation.description")}
      title={messageTranslate("admin.impersonation.start")}
    >
      <div class="px-3 py-3">
        <ImpersonationAdminStartForm state={props.state} />
      </div>
    </AuthenticatedSection>
  )
}
