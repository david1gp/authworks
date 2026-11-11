import { For, Show } from "solid-js"
import { AuthenticatedCardList } from "../../../ui/authenticated/AuthenticatedCardList.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedPagination } from "../../../ui/authenticated/AuthenticatedPagination.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import { AdminSessionCard } from "./AdminSessionCard.js"
import type { adminPageStateCreate } from "./adminPageStateCreate.js"
import { adminViewStatusPanelState } from "./adminViewStatusPanelState.js"

export function AdminSessionListView(props: { readonly state: ReturnType<typeof adminPageStateCreate> }) {
  return (
    <div class="grid min-w-0 gap-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-baseline gap-3">
          <h1 class="text-lg font-semibold">{messageTranslate("shell.nav.sessions")}</h1>
          <span class="text-xs text-muted-foreground">
            {props.state.sessions().length} {messageTranslate("admin.redesign.sessionsOnThisPage")}
          </span>
        </div>
        <AuthenticatedInput
          class="w-full sm:w-64"
          aria-label={messageTranslate("admin.redesign.searchSessions")}
          type="search"
          placeholder={messageTranslate("admin.redesign.searchSessions")}
          value={props.state.sessionSearch()}
          onInput={(event) => props.state.sessionSearchInput(event.currentTarget.value)}
        />
      </div>
      <Show when={props.state.notice()}>{(notice) => <AuthenticatedNotice message={notice()} />}</Show>
      <Show
        when={props.state.status() === "ready"}
        fallback={
          <ProductionStatePanel
            detail={
              props.state.status() === "permission-denied"
                ? messageTranslate("admin.common.permission")
                : props.state.error()
            }
            onRetry={props.state.status() === "error" ? props.state.reload : undefined}
            state={adminViewStatusPanelState(props.state.status())}
            title={
              props.state.status() === "empty"
                ? props.state.sessionSearch().trim().length > 0
                  ? messageTranslate("admin.redesign.noSessionsMatchYourSearch")
                  : messageTranslate("account.sessions.empty")
                : undefined
            }
          />
        }
      >
        <div>
          <AuthenticatedCardList label={messageTranslate("shell.nav.sessions")}>
            <For each={props.state.sessions()}>
              {(session) => (
                <AdminSessionCard
                  session={session}
                  disabled={props.state.pendingId() !== undefined}
                  onRevoke={() => void props.state.sessionRevoke(session.userId ?? session.subjectId, session.id)}
                />
              )}
            </For>
          </AuthenticatedCardList>
          <AuthenticatedPagination
            nextAvailable={props.state.hasNextPage()}
            onNext={props.state.pageNext}
            onPrevious={props.state.pagePrevious}
            previousAvailable={props.state.hasPreviousPage()}
          />
        </div>
      </Show>
      <Show when={props.state.status() === "empty"}>
        <AuthenticatedPagination
          nextAvailable={props.state.hasNextPage()}
          onNext={props.state.pageNext}
          onPrevious={props.state.pagePrevious}
          previousAvailable={props.state.hasPreviousPage()}
        />
      </Show>
    </div>
  )
}
