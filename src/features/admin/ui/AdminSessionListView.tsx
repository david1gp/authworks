import { mdiCancel } from "@adaptive-ds/mdi/mdiCancel.js"
import { For, Show } from "solid-js"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedPagination } from "../../../ui/authenticated/AuthenticatedPagination.js"
import { AuthenticatedRelativeTime } from "../../../ui/authenticated/AuthenticatedRelativeTime.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { authenticatedTableClasses } from "../../../ui/authenticated/authenticatedTableClasses.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import { sessionDeviceLabelGet } from "../../sessions/ui/sessionDeviceLabelGet.js"
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
        <AuthenticatedSection>
          <div class="overflow-x-auto">
            <Table class={authenticatedTableClasses.tableWide}>
              <TableHeader class={authenticatedTableClasses.header}>
                <TableRow>
                  <TableHead class={authenticatedTableClasses.head}>
                    {messageTranslate("admin.redesign.device")}
                  </TableHead>
                  <TableHead class={authenticatedTableClasses.head}>
                    {messageTranslate("admin.users.directoryUser")}
                  </TableHead>
                  <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.redesign.ip")}</TableHead>
                  <TableHead class={authenticatedTableClasses.head}>
                    {messageTranslate("admin.users.sessions.location")}
                  </TableHead>
                  <TableHead class={`${authenticatedTableClasses.head} text-right`}>
                    {messageTranslate("login.chooser.lastUsed")}
                  </TableHead>
                  <TableHead class={`${authenticatedTableClasses.head} text-right`}>
                    {messageTranslate("admin.users.sessions.expires")}
                  </TableHead>
                  <TableHead class={authenticatedTableClasses.head}>
                    <span class="sr-only">{messageTranslate("admin.redesign.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <For each={props.state.sessions()}>
                  {(session) => (
                    <TableRow class={authenticatedTableClasses.row} data-admin-session={session.id}>
                      <TableCell class={authenticatedTableClasses.cell}>
                        {sessionDeviceLabelGet(session.device)}
                        <span class="block font-mono text-xs text-muted-foreground">{session.id}</span>
                      </TableCell>
                      <TableCell class={authenticatedTableClasses.cell}>
                        <span title={session.subjectId}>
                          {session.subjectDisplayName || session.subjectEmail || session.subjectId}
                        </span>
                        <Show when={session.subjectDisplayName && session.subjectEmail}>
                          <span class="ml-2 text-xs text-muted-foreground">{session.subjectEmail}</span>
                        </Show>
                      </TableCell>
                      <TableCell class={`${authenticatedTableClasses.cell} font-mono text-xs`}>
                        {session.device.ipAddress || "—"}
                      </TableCell>
                      <TableCell class={authenticatedTableClasses.cell}>
                        {[session.device.region, session.device.countryCode].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell class={`${authenticatedTableClasses.cell} text-right`}>
                        <AuthenticatedRelativeTime value={session.lastUsedAt} />
                      </TableCell>
                      <TableCell class={`${authenticatedTableClasses.cell} text-right`}>
                        <AuthenticatedRelativeTime value={session.expiresAt} />
                      </TableCell>
                      <TableCell class={authenticatedTableClasses.action}>
                        <AuthenticatedButton
                          aria-label={messageTranslate("common.revoke")}
                          title={messageTranslate("common.revoke")}
                          disabled={props.state.pendingId() !== undefined}
                          icon={mdiCancel}
                          onClick={() =>
                            void props.state.sessionRevoke(session.userId ?? session.subjectId, session.id)
                          }
                          variant="outline"
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </For>
              </TableBody>
            </Table>
          </div>
          <AuthenticatedPagination
            nextAvailable={props.state.hasNextPage()}
            onNext={props.state.pageNext}
            onPrevious={props.state.pagePrevious}
            previousAvailable={props.state.hasPreviousPage()}
          />
        </AuthenticatedSection>
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
