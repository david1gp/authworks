import { mdiDownloadOutline } from "@adaptive-ds/mdi/mdiDownloadOutline.js"
import { mdiFilterRemoveOutline } from "@adaptive-ds/mdi/mdiFilterRemoveOutline.js"
import { mdiMagnify } from "@adaptive-ds/mdi/mdiMagnify.js"
import { Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedEmptyState } from "../../../ui/authenticated/AuthenticatedEmptyState.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedPagination } from "../../../ui/authenticated/AuthenticatedPagination.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedToolbar } from "../../../ui/authenticated/AuthenticatedToolbar.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import { AdminEventTable } from "./AdminEventTable.js"
import type { adminPageStateCreate } from "./adminPageStateCreate.js"
import { adminViewStatusPanelState } from "./adminViewStatusPanelState.js"

export function AdminEventListView(props: { readonly state: ReturnType<typeof adminPageStateCreate> }) {
  return (
    <section aria-label={messageTranslate("admin.events.title")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <header class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-baseline gap-3">
          <h1 class="text-lg font-semibold">{messageTranslate("admin.events.title")}</h1>
          <span class="text-xs text-muted-foreground">
            {messageTranslate("admin.events.count", { count: props.state.events().length })}
          </span>
        </div>
        <div class="flex gap-2">
          <AuthenticatedButton
            size="sm"
            disabled={props.state.pendingId() !== undefined}
            icon={mdiDownloadOutline}
            onClick={() => void props.state.eventsExport()}
            variant="outline"
          >
            {messageTranslate("admin.events.export")}
          </AuthenticatedButton>
          <AuthenticatedButton
            size="sm"
            icon={mdiFilterRemoveOutline}
            onClick={() => props.state.eventFiltersClear()}
            variant="outline"
          >
            {messageTranslate("admin.users.directoryClearFilters")}
          </AuthenticatedButton>
        </div>
      </header>
      <AuthenticatedToolbar label={messageTranslate("admin.events.title")}>
        <Label class="sr-only" for="admin-event-type">
          {messageTranslate("admin.events.type")}
        </Label>
        <AuthenticatedInput
          class="w-full sm:w-32"
          id="admin-event-type"
          placeholder={messageTranslate("admin.events.type")}
          onInput={(event) => props.state.eventFilterSet("eventType", event.currentTarget.value)}
          value={props.state.eventFilters().eventType ?? ""}
        />
        <Label class="sr-only" for="admin-event-aggregate-type">
          {messageTranslate("admin.events.aggregate")}
        </Label>
        <AuthenticatedInput
          class="w-full sm:w-32"
          id="admin-event-aggregate-type"
          placeholder={messageTranslate("admin.events.aggregate")}
          onInput={(event) => props.state.eventFilterSet("aggregateType", event.currentTarget.value)}
          value={props.state.eventFilters().aggregateType ?? ""}
        />
        <Label class="sr-only" for="admin-event-actor">
          {messageTranslate("admin.events.actor")}
        </Label>
        <AuthenticatedInput
          class="w-full sm:w-32"
          id="admin-event-actor"
          placeholder={messageTranslate("admin.events.actor")}
          onInput={(event) => props.state.eventFilterSet("actorId", event.currentTarget.value)}
          value={props.state.eventFilters().actorId ?? ""}
        />
        <Label class="text-xs text-muted-foreground" for="admin-event-occurred-from">
          {messageTranslate("admin.redesign.from")}
        </Label>
        <AuthenticatedInput
          class="w-full sm:w-36"
          id="admin-event-occurred-from"
          aria-label={messageTranslate("admin.redesign.from")}
          placeholder={messageTranslate("admin.redesign.from")}
          onInput={(event) => props.state.eventFilterSet("occurredFrom", event.currentTarget.value)}
          type="date"
          value={props.state.eventFilters().occurredFrom ?? ""}
        />
        <Label class="text-xs text-muted-foreground" for="admin-event-occurred-to">
          {messageTranslate("admin.redesign.to")}
        </Label>
        <AuthenticatedInput
          class="w-full sm:w-36"
          id="admin-event-occurred-to"
          aria-label={messageTranslate("admin.redesign.to")}
          placeholder={messageTranslate("admin.redesign.to")}
          onInput={(event) => props.state.eventFilterSet("occurredTo", event.currentTarget.value)}
          type="date"
          value={props.state.eventFilters().occurredTo ?? ""}
        />
        <AuthenticatedButton
          size="sm"
          variant="outline"
          aria-expanded={props.state.eventMoreFilters()}
          onClick={props.state.eventMoreFiltersToggle}
        >
          {messageTranslate("admin.redesign.moreFilters")}
        </AuthenticatedButton>
        <Show when={props.state.eventMoreFilters()}>
          <Label class="sr-only" for="admin-event-aggregate-id">
            {messageTranslate("admin.events.aggregateId")}
          </Label>
          <AuthenticatedInput
            class="w-full sm:w-32"
            id="admin-event-aggregate-id"
            onInput={(event) => props.state.eventFilterSet("aggregateId", event.currentTarget.value)}
            value={props.state.eventFilters().aggregateId ?? ""}
          />
          <Label class="sr-only" for="admin-event-user-subject">
            {messageTranslate("admin.events.userSubject")}
          </Label>
          <AuthenticatedInput
            class="w-full sm:w-32"
            id="admin-event-user-subject"
            onInput={(event) => props.state.eventFilterSet("userSubjectId", event.currentTarget.value)}
            value={props.state.eventFilters().userSubjectId ?? ""}
          />
        </Show>
      </AuthenticatedToolbar>

      <Show when={props.state.notice()}>{(notice) => <AuthenticatedNotice message={notice()} />}</Show>

      <Show
        when={props.state.status() === "ready"}
        fallback={
          <ProductionStatePanel
            detail={
              props.state.status() === "empty"
                ? messageTranslate("admin.events.empty")
                : props.state.status() === "permission-denied"
                  ? messageTranslate("admin.common.permission")
                  : props.state.error()
            }
            onRetry={props.state.status() === "error" ? props.state.reload : undefined}
            state={adminViewStatusPanelState(props.state.status())}
          />
        }
      >
        <AuthenticatedSection>
          {/* A search with no matches shows the empty state instead of a header-only table. */}
          <Show
            fallback={
              <AuthenticatedEmptyState
                description={messageTranslate("admin.events.empty")}
                icon={mdiMagnify}
                title={messageTranslate("admin.events.search")}
              />
            }
            when={props.state.events().length > 0}
          >
            <AdminEventTable state={props.state} />
          </Show>
          <AuthenticatedPagination
            nextAvailable={props.state.hasNextPage()}
            onNext={props.state.pageNext}
            onPrevious={props.state.pagePrevious}
            previousAvailable={props.state.hasPreviousPage()}
            summary={messageTranslate("admin.events.count", { count: props.state.events().length })}
          />
        </AuthenticatedSection>
      </Show>
    </section>
  )
}
