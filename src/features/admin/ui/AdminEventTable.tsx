import { mdiChevronDown } from "@adaptive-ds/mdi/mdiChevronDown.js"
import { mdiChevronUp } from "@adaptive-ds/mdi/mdiChevronUp.js"
import { For, Show } from "solid-js"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedCopyableId } from "../../../ui/authenticated/AuthenticatedCopyableId.js"
import { AuthenticatedRelativeTime } from "../../../ui/authenticated/AuthenticatedRelativeTime.js"
import { authenticatedTableClasses } from "../../../ui/authenticated/authenticatedTableClasses.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { adminEventPayloadDisplay } from "./adminEventPayloadDisplay.js"
import type { adminPageStateCreate } from "./adminPageStateCreate.js"

export function AdminEventTable(props: { readonly state: ReturnType<typeof adminPageStateCreate> }) {
  return (
    <>
      <p class="px-3 py-1 text-xs text-muted-foreground md:hidden">
        {messageTranslate("admin.redesign.scrollHorizontallyToSeeAllEventDetails")}
      </p>
      <Table class={authenticatedTableClasses.table} tabindex={0}>
        <TableHeader class={authenticatedTableClasses.header}>
          <TableRow>
            <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.events.occurred")}</TableHead>
            <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.events.type")}</TableHead>
            <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.events.aggregate")}</TableHead>
            <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.events.actor")}</TableHead>
            <TableHead class={`${authenticatedTableClasses.head} text-right`}>
              {messageTranslate("admin.events.payload")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <For each={props.state.events()}>
            {(item) => (
              <>
                <TableRow class={authenticatedTableClasses.row}>
                  <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap tabular-nums`}>
                    <AuthenticatedRelativeTime value={item.occurredAt} />
                  </TableCell>
                  <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap`}>
                    <span
                      class={`rounded px-1.5 py-0.5 font-mono text-xs ${item.eventType.startsWith("user.") ? "bg-accent-soft text-accent" : item.eventType.startsWith("oidc.") ? "bg-success-soft text-success" : item.eventType.startsWith("impersonation.") ? "bg-warning-soft text-warning" : item.eventType.startsWith("realm.") ? "bg-danger-soft text-danger" : "bg-surface-hover text-muted-foreground"}`}
                      title={item.eventType}
                    >
                      {item.eventType}
                    </span>
                  </TableCell>
                  <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap`}>
                    <span class="inline-flex items-center gap-2">
                      <span
                        class="rounded bg-surface-hover px-1.5 py-0.5 text-xs text-muted-foreground"
                        title={item.aggregateType}
                      >
                        {item.aggregateType}
                      </span>
                      <AuthenticatedCopyableId
                        label={messageTranslate("admin.events.aggregateId")}
                        value={item.aggregateId}
                      />
                    </span>
                  </TableCell>
                  <TableCell
                    class={`${authenticatedTableClasses.cell} w-[22%] max-w-[28ch] truncate`}
                    title={item.actorId || messageTranslate("admin.events.systemActor")}
                  >
                    <Show
                      when={item.actorDisplayName}
                      fallback={
                        <Show when={item.actorId} fallback={messageTranslate("admin.events.systemActor")}>
                          {(id) => (
                            <AuthenticatedCopyableId label={messageTranslate("admin.events.actor")} value={id()} />
                          )}
                        </Show>
                      }
                    >
                      {item.actorDisplayName}
                    </Show>
                  </TableCell>
                  <TableCell class={authenticatedTableClasses.action}>
                    <AuthenticatedButton
                      size="sm"
                      icon={props.state.expandedEventId() === item.id ? mdiChevronUp : mdiChevronDown}
                      aria-label={
                        props.state.expandedEventId() === item.id
                          ? messageTranslate("admin.events.hide")
                          : messageTranslate("admin.events.show")
                      }
                      title={
                        props.state.expandedEventId() === item.id
                          ? messageTranslate("admin.events.hide")
                          : messageTranslate("admin.events.show")
                      }
                      aria-expanded={props.state.expandedEventId() === item.id}
                      onClick={() => props.state.eventExpandToggle(item.id)}
                      variant="outline"
                    />
                  </TableCell>
                </TableRow>
                <Show when={props.state.expandedEventId() === item.id}>
                  <TableRow class={authenticatedTableClasses.row}>
                    <TableCell class="px-3 py-2" colSpan={5}>
                      <p class="mb-1.5 text-xs text-muted-foreground">
                        {messageTranslate("admin.events.redactionNotice")}
                      </p>
                      <pre class="max-h-64 overflow-auto rounded bg-surface-hover p-3 font-mono text-xs">
                        {adminEventPayloadDisplay(item.payload)}
                      </pre>
                    </TableCell>
                  </TableRow>
                </Show>
              </>
            )}
          </For>
        </TableBody>
      </Table>
    </>
  )
}
