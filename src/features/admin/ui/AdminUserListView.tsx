import { A } from "@solidjs/router"
import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedPagination } from "../../../ui/authenticated/AuthenticatedPagination.js"
import { AuthenticatedRecordItem } from "../../../ui/authenticated/AuthenticatedRecordItem.js"
import { AuthenticatedRecordList } from "../../../ui/authenticated/AuthenticatedRecordList.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { AuthenticatedToolbar } from "../../../ui/authenticated/AuthenticatedToolbar.js"
import { authenticatedTableClasses } from "../../../ui/authenticated/authenticatedTableClasses.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { adminPageStateCreate } from "./adminPageStateCreate.js"
import { adminUserStateTone } from "./adminUserStateTone.js"
import { adminViewStatusPanelState } from "./adminViewStatusPanelState.js"

type AdminUserListViewState = ReturnType<typeof adminPageStateCreate>

export function AdminUserListView(props: { readonly detailHrefBase: string; readonly state: AdminUserListViewState }) {
  return (
    <section aria-label={messageTranslate("admin.users.title")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <AuthenticatedToolbar
        actions={
          <AuthenticatedDialog
            class="h-8 text-xs"
            description={messageTranslate("admin.users.createDescription")}
            onOpenChange={props.state.createOpen.set}
            open={props.state.createOpen.get()}
            title={messageTranslate("admin.users.create")}
            triggerLabel={messageTranslate("admin.users.create")}
            variant="filledBlue"
          >
            <form class="grid gap-3" onSubmit={props.state.userCreateSubmit}>
              <div class="grid gap-1">
                <Label for="admin-user-email">{messageTranslate("admin.users.email")}</Label>
                <Input
                  id="admin-user-email"
                  onInput={(event) => props.state.createEmail.set(event.currentTarget.value)}
                  type="email"
                  value={props.state.createEmail.get()}
                />
              </div>
              <div class="grid gap-1">
                <Label for="admin-user-name">{messageTranslate("admin.users.userName")}</Label>
                <Input
                  id="admin-user-name"
                  onInput={(event) => props.state.createUserName.set(event.currentTarget.value)}
                  value={props.state.createUserName.get()}
                />
              </div>
              <div class="grid gap-1">
                <Label for="admin-user-display-name">{messageTranslate("admin.users.displayName")}</Label>
                <Input
                  id="admin-user-display-name"
                  onInput={(event) => props.state.createDisplayName.set(event.currentTarget.value)}
                  value={props.state.createDisplayName.get()}
                />
              </div>
              <Show when={props.state.validationMessage()}>
                {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
              </Show>
              <Button type="submit" variant="filledBlue">
                {messageTranslate("admin.users.createSubmit")}
              </Button>
            </form>
          </AuthenticatedDialog>
        }
        label={messageTranslate("admin.users.title")}
        summary={messageTranslate("admin.users.count", { count: props.state.users().length })}
      >
        <Label class="sr-only" for="admin-user-search">
          {messageTranslate("admin.users.search")}
        </Label>
        <Input
          class="h-8 w-72 max-w-full text-sm"
          id="admin-user-search"
          onInput={(event) => props.state.searchTerm.set(event.currentTarget.value)}
          placeholder={messageTranslate("admin.users.searchPlaceholder")}
          value={props.state.searchTerm.get()}
        />
      </AuthenticatedToolbar>

      <Show when={props.state.notice()}>{(notice) => <AuthenticatedNotice message={notice()} />}</Show>

      <Show
        when={props.state.status() === "ready"}
        fallback={
          <ProductionStatePanel
            detail={
              props.state.status() === "empty"
                ? messageTranslate("admin.users.empty")
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
          <AuthenticatedRecordList label={messageTranslate("admin.users.title")}>
            <For each={props.state.users()}>
              {(item) => (
                <AuthenticatedRecordItem
                  fields={[
                    { label: messageTranslate("admin.users.email"), value: item.email, wide: true },
                    {
                      label: messageTranslate("admin.users.createdAt"),
                      value: localeDateFormat(item.createdAt, { dateStyle: "medium" }),
                    },
                  ]}
                  status={
                    <>
                      <AuthenticatedStatus
                        label={
                          item.emailVerified
                            ? messageTranslate("admin.users.verified")
                            : messageTranslate("admin.users.unverified")
                        }
                        tone={item.emailVerified ? "success" : "neutral"}
                      />
                      <AuthenticatedStatus
                        label={messageTranslate(`admin.users.lifecycle.${item.state}`)}
                        tone={adminUserStateTone(item.state)}
                      />
                    </>
                  }
                  title={
                    <span class="flex items-center gap-2">
                      <Show when={item.profile.picture?.url}>
                        {(url) => (
                          <img
                            alt={messageTranslate("admin.users.pictureAlt")}
                            class="size-6 shrink-0 rounded-full border border-line object-cover"
                            src={url()}
                          />
                        )}
                      </Show>
                      <A
                        class="min-w-0 truncate text-accent hover:underline"
                        href={`${props.detailHrefBase}/${item.id}`}
                      >
                        {item.userName}
                      </A>
                    </span>
                  }
                />
              )}
            </For>
          </AuthenticatedRecordList>
          <Table class={authenticatedTableClasses.tableWide} tabindex={0}>
            <TableHeader class={authenticatedTableClasses.header}>
              <TableRow>
                <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.users.userName")}</TableHead>
                <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.users.email")}</TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.users.verification")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.users.state")}</TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.users.createdAt")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={props.state.users()}>
                {(item) => (
                  <TableRow class={authenticatedTableClasses.row}>
                    <TableCell class={authenticatedTableClasses.cell}>
                      <div class="flex items-center gap-2">
                        <Show when={item.profile.picture?.url}>
                          {(url) => (
                            <img
                              alt={messageTranslate("admin.users.pictureAlt")}
                              class="size-6 shrink-0 rounded-full border border-line object-cover"
                              src={url()}
                            />
                          )}
                        </Show>
                        <A
                          class="min-w-0 truncate font-medium text-accent hover:underline"
                          href={`${props.detailHrefBase}/${item.id}`}
                        >
                          {item.userName}
                        </A>
                      </div>
                    </TableCell>
                    <TableCell class={authenticatedTableClasses.cell}>{item.email}</TableCell>
                    <TableCell class={authenticatedTableClasses.cell}>
                      <AuthenticatedStatus
                        label={
                          item.emailVerified
                            ? messageTranslate("admin.users.verified")
                            : messageTranslate("admin.users.unverified")
                        }
                        tone={item.emailVerified ? "success" : "neutral"}
                      />
                    </TableCell>
                    <TableCell class={authenticatedTableClasses.cell}>
                      <AuthenticatedStatus
                        label={messageTranslate(`admin.users.lifecycle.${item.state}`)}
                        tone={adminUserStateTone(item.state)}
                      />
                    </TableCell>
                    <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap tabular-nums`}>
                      {localeDateFormat(item.createdAt, { dateStyle: "medium" })}
                    </TableCell>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>
          <AuthenticatedPagination
            nextAvailable={props.state.hasNextPage()}
            onNext={props.state.pageNext}
            onPrevious={props.state.pagePrevious}
            previousAvailable={props.state.hasPreviousPage()}
            summary={messageTranslate("admin.users.count", { count: props.state.users().length })}
          />
        </AuthenticatedSection>
      </Show>
    </section>
  )
}
