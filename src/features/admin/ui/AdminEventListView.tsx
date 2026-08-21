import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { CodeBlock } from "#ui/static/code/CodeBlock.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import { adminEventPayloadDisplay } from "./adminEventPayloadDisplay.js"
import type { adminPageStateCreate } from "./adminPageStateCreate.js"

export function AdminEventListView(props: { readonly state: ReturnType<typeof adminPageStateCreate> }) {
  return (
    <section aria-label={messageTranslate("admin.events.title")} class="grid gap-5">
      <p class="max-w-2xl text-sm leading-6 text-muted-foreground">{messageTranslate("admin.events.description")}</p>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="grid gap-2">
          <Label class="sr-only" for="admin-event-search">
            {messageTranslate("admin.events.search")}
          </Label>
          <Input
            class="w-72 max-w-full"
            id="admin-event-search"
            onInput={(event) => props.state.searchTerm.set(event.currentTarget.value)}
            placeholder={messageTranslate("admin.events.searchPlaceholder")}
            value={props.state.searchTerm.get()}
          />
        </div>
        <span class="text-sm text-muted-foreground">
          {messageTranslate("admin.events.count", { count: props.state.events().length })}
        </span>
      </div>

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
            state={
              props.state.status() === "loading"
                ? "loading"
                : props.state.status() === "empty"
                  ? "empty"
                  : props.state.status() === "permission-denied" || props.state.status() === "expired"
                    ? "inaccessible"
                    : "error"
            }
          />
        }
      >
        <div class="rounded-2xl border border-line bg-surface shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messageTranslate("admin.events.occurred")}</TableHead>
                <TableHead>{messageTranslate("admin.events.type")}</TableHead>
                <TableHead>{messageTranslate("admin.events.aggregate")}</TableHead>
                <TableHead>{messageTranslate("admin.events.actor")}</TableHead>
                <TableHead class="text-right">{messageTranslate("admin.events.payload")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={props.state.events()}>
                {(item) => (
                  <>
                    <TableRow>
                      <TableCell>
                        {localeDateFormat(item.occurredAt, { dateStyle: "medium", timeStyle: "short" })}
                      </TableCell>
                      <TableCell class="font-medium">{item.eventType}</TableCell>
                      <TableCell>
                        {item.aggregateType}
                        <span class="block font-mono text-xs text-muted-foreground">{item.aggregateId}</span>
                      </TableCell>
                      <TableCell class="font-mono text-xs">
                        {item.actorId ?? messageTranslate("admin.events.systemActor")}
                      </TableCell>
                      <TableCell class="text-right">
                        <Button onClick={() => props.state.eventExpandToggle(item.id)} variant="link">
                          {props.state.expandedEventId() === item.id
                            ? messageTranslate("admin.events.hide")
                            : messageTranslate("admin.events.show")}
                        </Button>
                      </TableCell>
                    </TableRow>
                    <Show when={props.state.expandedEventId() === item.id}>
                      <TableRow>
                        <TableCell colSpan={5}>
                          <p class="mb-2 text-xs text-muted-foreground">
                            {messageTranslate("admin.events.redactionNotice")}
                          </p>
                          <CodeBlock data={adminEventPayloadDisplay(item.payload)} />
                        </TableCell>
                      </TableRow>
                    </Show>
                  </>
                )}
              </For>
            </TableBody>
          </Table>
        </div>
        <nav aria-label={messageTranslate("admin.common.pagination")} class="flex justify-end gap-2">
          <Button disabled={!props.state.hasPreviousPage()} onClick={props.state.pagePrevious} variant="outline">
            {messageTranslate("admin.common.previous")}
          </Button>
          <Button disabled={!props.state.hasNextPage()} onClick={props.state.pageNext} variant="outline">
            {messageTranslate("admin.common.next")}
          </Button>
        </nav>
      </Show>
    </section>
  )
}
