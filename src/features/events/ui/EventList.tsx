import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { CodeBlock } from "#ui/static/code/CodeBlock.jsx"
import { PageWrapper } from "#ui/static/page/PageWrapper.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { eventListStateCreate } from "./eventListStateCreate.js"

export function EventList() {
  const state = eventListStateCreate()
  return (
    <PageWrapper class="bg-transparent" innerClass="max-w-7xl">
      <div>
        <p class="text-sm font-medium text-blue-600">Administration</p>
        <h1 class="text-3xl font-semibold tracking-tight">Events</h1>
        <p class="mt-1 text-muted-foreground">Review the realm event stream and payloads.</p>
      </div>
      <CardWrapper class="mt-6">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Label for="event-search" class="sr-only">
            Search events
          </Label>
          <Input
            id="event-search"
            class="max-w-sm"
            placeholder="Search event type, aggregate or actor"
            value={state.query()}
            onInput={(event) => state.searchSet(event.currentTarget.value)}
          />
          <span class="text-sm text-muted-foreground">{state.filteredEvents().length} events</span>
        </div>
        <Show
          when={state.filteredEvents().length > 0}
          fallback={<p class="py-8 text-center text-muted-foreground">No events found.</p>}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Occurred</TableHead>
                <TableHead>Event type</TableHead>
                <TableHead>Aggregate</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead class="text-right">Payload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={state.filteredEvents()}>
                {(event) => (
                  <>
                    <TableRow>
                      <TableCell>{new Date(event.occurredAt).toLocaleString()}</TableCell>
                      <TableCell class="font-medium">{event.eventType}</TableCell>
                      <TableCell>
                        {event.aggregateType}
                        <span class="block font-mono text-xs text-muted-foreground">{event.aggregateId}</span>
                      </TableCell>
                      <TableCell class="font-mono text-xs">{event.actorId ?? "system"}</TableCell>
                      <TableCell class="text-right">
                        <Button variant="link" onClick={() => state.toggleExpanded(event.id)}>
                          {state.expandedId() === event.id ? "Hide" : "Show"}
                        </Button>
                      </TableCell>
                    </TableRow>
                    <Show when={state.expandedId() === event.id}>
                      <TableRow>
                        <TableCell colSpan={5}>
                          <CodeBlock data={event.payload} />
                        </TableCell>
                      </TableRow>
                    </Show>
                  </>
                )}
              </For>
            </TableBody>
          </Table>
        </Show>
      </CardWrapper>
    </PageWrapper>
  )
}
