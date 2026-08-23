import { A } from "@solidjs/router"
import { Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ImpersonationAdminBanner } from "./ImpersonationAdminBanner.js"
import { ImpersonationAdminStartForm } from "./ImpersonationAdminStartForm.js"
import { ImpersonationAdminStateBoundary } from "./ImpersonationAdminStateBoundary.js"
import { impersonationAdminRemainingFormat } from "./impersonationAdminRemainingFormat.js"
import type { ImpersonationAdminPageState } from "./impersonationAdminPageStateCreate.js"

/** The single stateless view shared by the production and demo impersonation adapters. */
export function ImpersonationAdminView(props: {
  readonly basePath: string
  readonly state: ImpersonationAdminPageState
}) {
  const state = props.state
  return (
    <section aria-label={messageTranslate("admin.impersonation.title")} class="grid min-w-0 gap-6">
      {/* The page heading stays outside the guarded boundary, so every fixture state has one h1. */}
      <h1 class="text-2xl font-semibold tracking-tight">{messageTranslate("admin.impersonation.title")}</h1>
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

      <Show when={state.notice()}>
        {(notice) => (
          <p class="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900" role="status">
            {notice()}
          </p>
        )}
      </Show>

      <ImpersonationAdminStateBoundary error={state.error()} onRetry={state.reload} status={state.status()}>
        <Show when={state.active()} fallback={<ImpersonationAdminStartSection state={state} />}>
          {(session) => (
            <CardWrapper>
              <h2 class="text-xl font-semibold">{messageTranslate("admin.impersonation.activeTitle")}</h2>
              <dl class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <DetailItem label={messageTranslate("admin.impersonation.actor")} value={session().actorLabel} />
                <DetailItem label={messageTranslate("admin.impersonation.subject")} value={session().subjectLabel} />
                <DetailItem
                  label={messageTranslate("admin.impersonation.remaining")}
                  value={impersonationAdminRemainingFormat(state.remainingSeconds())}
                />
                <DetailItem
                  label={messageTranslate("admin.impersonation.startedAt")}
                  value={localeDateFormat(session().startedAt, { dateStyle: "medium", timeStyle: "short" })}
                />
                <DetailItem
                  label={messageTranslate("admin.impersonation.expires")}
                  value={localeDateFormat(session().expiresAt, { dateStyle: "medium", timeStyle: "short" })}
                />
                <DetailItem label={messageTranslate("admin.impersonation.reason")} value={session().reason ?? ""} />
              </dl>
              <div class="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  disabled={state.pendingId() !== undefined}
                  onClick={() => void state.impersonationEnd()}
                  variant="filledRed"
                >
                  {messageTranslate("admin.impersonation.end")}
                </Button>
                <A class="text-sm font-medium text-accent hover:underline" href={state.eventsHref(props.basePath)}>
                  {messageTranslate("admin.impersonation.auditLink")}
                </A>
              </div>
            </CardWrapper>
          )}
        </Show>
      </ImpersonationAdminStateBoundary>
    </section>
  )
}

function ImpersonationAdminStartSection(props: { readonly state: ImpersonationAdminPageState }) {
  return (
    <CardWrapper>
      <h2 class="text-xl font-semibold">{messageTranslate("admin.impersonation.start")}</h2>
      <p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        {messageTranslate("admin.impersonation.description")}
      </p>
      <div class="mt-5 max-w-lg">
        <ImpersonationAdminStartForm state={props.state} />
      </div>
    </CardWrapper>
  )
}

function DetailItem(props: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt class="text-sm text-muted-foreground">{props.label}</dt>
      <dd class="mt-1 break-words text-sm font-medium">{props.value}</dd>
    </div>
  )
}
