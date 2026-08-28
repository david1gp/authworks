import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { CodeBlock } from "#ui/static/code/CodeBlock.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { AuthenticatedPagination } from "../../../ui/authenticated/AuthenticatedPagination.js"
import { AuthenticatedRecordItem } from "../../../ui/authenticated/AuthenticatedRecordItem.js"
import { AuthenticatedRecordList } from "../../../ui/authenticated/AuthenticatedRecordList.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedToolbar } from "../../../ui/authenticated/AuthenticatedToolbar.js"
import { authenticatedTableClasses } from "../../../ui/authenticated/authenticatedTableClasses.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import { adminEventPayloadDisplay } from "./adminEventPayloadDisplay.js"
import type { adminPageStateCreate } from "./adminPageStateCreate.js"
import { adminViewStatusPanelState } from "./adminViewStatusPanelState.js"

export function AdminEventListView(props: { readonly state: ReturnType<typeof adminPageStateCreate> }) {
  return (
    <section aria-label={messageTranslate("admin.events.title")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <AuthenticatedToolbar
        label={messageTranslate("admin.events.title")}
        summary={messageTranslate("admin.events.count", { count: props.state.events().length })}
      >
        <Label class="sr-only" for="admin-event-search">
          {messageTranslate("admin.events.search")}
        </Label>
        <Input
          class="h-8 w-72 max-w-full text-sm"
          id="admin-event-search"
          onInput={(event) => props.state.searchTerm.set(event.currentTarget.value)}
          placeholder={messageTranslate("admin.events.searchPlaceholder")}
          value={props.state.searchTerm.get()}
        />
      </AuthenticatedToolbar>

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
          <AuthenticatedRecordList label={messageTranslate("admin.events.title")}>
            <For each={props.state.events()}>
              {(item) => (
                <AuthenticatedRecordItem
                  actions={
                    <Button
                      class="h-7 text-xs"
                      onClick={() => props.state.eventExpandToggle(item.id)}
                      size="sm"
                      variant="outline"
                    >
                      {props.state.expandedEventId() === item.id
                        ? messageTranslate("admin.events.hide")
                        : messageTranslate("admin.events.show")}
                    </Button>
                  }
                  fields={[
                    {
                      label: messageTranslate("admin.events.occurred"),
                      value: localeDateFormat(item.occurredAt, { dateStyle: "medium", timeStyle: "short" }),
                    },
                    {
                      label: messageTranslate("admin.events.aggregate"),
                      value: (
                        <>
                          <span class="block truncate">{item.aggregateType}</span>
                          <span class="block truncate font-mono text-2xs font-normal text-muted-foreground">
                            {item.aggregateId}
                          </span>
                        </>
                      ),
                    },
                    {
                      identifier: true,
                      label: messageTranslate("admin.events.actor"),
                      value: item.actorId ?? messageTranslate("admin.events.systemActor"),
                      wide: true,
                    },
                  ]}
                  title={item.eventType}
                >
                  <Show when={props.state.expandedEventId() === item.id}>
                    <div>
                      <p class="mb-1.5 text-xs text-muted-foreground">
                        {messageTranslate("admin.events.redactionNotice")}
                      </p>
                      <CodeBlock data={adminEventPayloadDisplay(item.payload)} />
                    </div>
                  </Show>
                </AuthenticatedRecordItem>
              )}
            </For>
          </AuthenticatedRecordList>
          <Table class={authenticatedTableClasses.tableWide} tabindex={0}>
            <TableHeader class={authenticatedTableClasses.header}>
              <TableRow>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.events.occurred")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.events.type")}</TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.events.aggregate")}
                </TableHead>
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
                        {localeDateFormat(item.occurredAt, { dateStyle: "medium", timeStyle: "short" })}
                      </TableCell>
                      <TableCell class={`${authenticatedTableClasses.cell} font-medium`}>{item.eventType}</TableCell>
                      <TableCell class={authenticatedTableClasses.cell}>
                        <span class="block truncate">{item.aggregateType}</span>
                        <span class="block max-w-[22ch] truncate font-mono text-2xs text-muted-foreground">
                          {item.aggregateId}
                        </span>
                      </TableCell>
                      <TableCell class={authenticatedTableClasses.identifier}>
                        {item.actorId ?? messageTranslate("admin.events.systemActor")}
                      </TableCell>
                      <TableCell class={authenticatedTableClasses.action}>
                        <Button
                          class="h-7 text-xs"
                          onClick={() => props.state.eventExpandToggle(item.id)}
                          size="sm"
                          variant="outline"
                        >
                          {props.state.expandedEventId() === item.id
                            ? messageTranslate("admin.events.hide")
                            : messageTranslate("admin.events.show")}
                        </Button>
                      </TableCell>
                    </TableRow>
                    <Show when={props.state.expandedEventId() === item.id}>
                      <TableRow class={authenticatedTableClasses.row}>
                        <TableCell class="px-3 py-2" colSpan={5}>
                          <p class="mb-1.5 text-xs text-muted-foreground">
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
