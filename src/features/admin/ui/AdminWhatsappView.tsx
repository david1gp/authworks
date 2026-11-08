import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { classMerge } from "#ui/utils/classMerge.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedRelativeTime } from "../../../ui/authenticated/AuthenticatedRelativeTime.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatTile } from "../../../ui/authenticated/AuthenticatedStatTile.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { authenticatedTableClasses } from "../../../ui/authenticated/authenticatedTableClasses.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { adminPageStateCreate } from "./adminPageStateCreate.js"
import { adminViewStatusPanelState } from "./adminViewStatusPanelState.js"
import { adminWhatsappViewStateCreate, type WhatsappSenderCard } from "./adminWhatsappViewStateCreate.js"

function AdminWhatsappQuotaBar(props: {
  readonly barLabel: string
  readonly limit: number
  readonly line: string
  readonly sent: number
  readonly width: string
  readonly windowLabel: string
}) {
  return (
    <div class="grid gap-1">
      <div class="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <span class="text-xs font-medium text-muted-foreground">{props.windowLabel}</span>
        <span class="text-xs tabular-nums text-muted-foreground">{props.line}</span>
      </div>
      <div
        aria-label={props.barLabel}
        aria-valuemax={props.limit}
        aria-valuemin={0}
        aria-valuenow={props.sent}
        class="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
      >
        <div
          aria-hidden="true"
          class="h-full rounded-full bg-accent transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: props.width }}
        />
      </div>
    </div>
  )
}

function AdminWhatsappSenderCard(props: { readonly card: WhatsappSenderCard }) {
  return (
    <div
      class="rounded-panel border border-line bg-surface p-4 shadow-panel"
      classList={{ "opacity-60": props.card.dimmed }}
    >
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div class="min-w-0">
          <p class="truncate text-[0.9375rem] font-semibold tracking-tight">{props.card.sessionName}</p>
          <p class="truncate font-mono text-xs text-muted-foreground">{props.card.endpointId}</p>
        </div>
        <AuthenticatedStatus label={props.card.healthLabel} tone={props.card.healthTone} />
      </div>
      <div class="grid gap-2.5">
        <AdminWhatsappQuotaBar
          barLabel={props.card.hour.barLabel}
          limit={props.card.hour.limit}
          line={props.card.hour.line}
          sent={props.card.hour.sent}
          width={props.card.hour.width}
          windowLabel={props.card.hour.windowLabel}
        />
        <AdminWhatsappQuotaBar
          barLabel={props.card.day.barLabel}
          limit={props.card.day.limit}
          line={props.card.day.line}
          sent={props.card.day.sent}
          width={props.card.day.width}
          windowLabel={props.card.day.windowLabel}
        />
      </div>
    </div>
  )
}

export function AdminWhatsappView(props: { readonly state: ReturnType<typeof adminPageStateCreate> }) {
  const view = adminWhatsappViewStateCreate({
    usage: () => props.state.whatsappUsage(),
    window: () => props.state.whatsappWindow(),
  })
  return (
    <section aria-label={messageTranslate("admin.whatsapp.title")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <header class="flex flex-wrap items-center justify-between gap-2">
        <h1 class="text-lg font-semibold">{messageTranslate("admin.whatsapp.title")}</h1>
      </header>

      <Show when={props.state.notice()}>{(notice) => <AuthenticatedNotice message={notice()} />}</Show>

      <Show
        when={props.state.status() === "ready"}
        fallback={
          <ProductionStatePanel
            detail={
              props.state.status() === "empty"
                ? messageTranslate("admin.whatsapp.empty")
                : props.state.status() === "permission-denied"
                  ? messageTranslate("admin.common.permission")
                  : props.state.error()
            }
            onRetry={props.state.status() === "error" ? props.state.reload : undefined}
            state={adminViewStatusPanelState(props.state.status())}
          />
        }
      >
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <For each={view.tiles()}>{(tile) => <AuthenticatedStatTile label={tile.label} value={tile.value} />}</For>
        </div>

        <Show when={view.senderCards().length > 0}>
          <AuthenticatedSection title={messageTranslate("admin.whatsapp.senders")}>
            <div class="grid gap-2 p-4 lg:grid-cols-2">
              <For each={view.senderCards()}>{(card) => <AdminWhatsappSenderCard card={card} />}</For>
            </div>
          </AuthenticatedSection>
        </Show>

        <Show when={view.purposeEntries().length > 0}>
          <AuthenticatedSection title={messageTranslate("admin.whatsapp.purposes")}>
            <div class="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <For each={view.purposeEntries()}>
                {(purpose) => <AuthenticatedStatTile label={purpose.name} value={purpose.count} />}
              </For>
            </div>
          </AuthenticatedSection>
        </Show>

        <div
          aria-label={messageTranslate("admin.whatsapp.windowLabel")}
          class="flex min-w-0 gap-1.5 overflow-x-auto rounded-panel border border-line bg-muted/60 p-1.5"
          role="group"
        >
          <For each={view.windowOptions()}>
            {(option) => (
              <Button
                aria-pressed={view.windowSelected(option.value)}
                class={classMerge(
                  "shrink-0 gap-2 rounded-control border px-3.5 py-2 text-sm whitespace-nowrap shadow-none focus-visible:ring-accent",
                  view.windowSelected(option.value)
                    ? "border-accent/50 bg-surface text-foreground shadow-sm"
                    : "border-transparent text-muted-foreground hover:border-line hover:bg-surface/70 hover:text-foreground",
                )}
                onClick={() => props.state.whatsappWindowSet(option.value)}
                size="none"
                type="button"
                variant="none"
              >
                {option.label}
              </Button>
            )}
          </For>
        </div>

        <Show when={view.recentRows().length > 0}>
          <AuthenticatedSection title={messageTranslate("admin.whatsapp.recent")}>
            <div class="overflow-x-auto">
              <Table class={authenticatedTableClasses.table}>
                <TableHeader class={authenticatedTableClasses.header}>
                  <TableRow>
                    <TableHead class={authenticatedTableClasses.head}>
                      {messageTranslate("admin.whatsapp.time")}
                    </TableHead>
                    <TableHead class={authenticatedTableClasses.head}>
                      {messageTranslate("admin.whatsapp.sender")}
                    </TableHead>
                    <TableHead class={authenticatedTableClasses.head}>
                      {messageTranslate("admin.whatsapp.endpoint")}
                    </TableHead>
                    <TableHead class={authenticatedTableClasses.head}>
                      {messageTranslate("admin.whatsapp.purpose")}
                    </TableHead>
                    <TableHead class={authenticatedTableClasses.head}>
                      {messageTranslate("admin.whatsapp.status")}
                    </TableHead>
                    <TableHead class={`${authenticatedTableClasses.head} text-right`}>
                      {messageTranslate("admin.whatsapp.phone")}
                    </TableHead>
                    <TableHead class={`${authenticatedTableClasses.head} text-right`}>
                      {messageTranslate("admin.whatsapp.code")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <For each={view.recentRows()}>
                    {(row) => (
                      <TableRow class={authenticatedTableClasses.row}>
                        <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap tabular-nums`}>
                          <AuthenticatedRelativeTime value={row.createdAt} />
                        </TableCell>
                        <TableCell class={authenticatedTableClasses.cell}>
                          {row.sessionName ?? messageTranslate("admin.whatsapp.noSender")}
                        </TableCell>
                        <TableCell class={`${authenticatedTableClasses.cell} font-mono text-xs`}>
                          {row.endpointId}
                        </TableCell>
                        <TableCell class={authenticatedTableClasses.cell}>{row.purpose}</TableCell>
                        <TableCell class={authenticatedTableClasses.cell}>
                          <AuthenticatedStatus
                            label={view.recentStatusGet(row.status).label}
                            tone={view.recentStatusGet(row.status).tone}
                          />
                        </TableCell>
                        <TableCell class={`${authenticatedTableClasses.cell} text-right font-mono text-xs`}>
                          {row.phone}
                        </TableCell>
                        <TableCell class={`${authenticatedTableClasses.cell} text-right font-mono text-xs`}>
                          {row.code}
                        </TableCell>
                      </TableRow>
                    )}
                  </For>
                </TableBody>
              </Table>
            </div>
          </AuthenticatedSection>
        </Show>
      </Show>
    </section>
  )
}
