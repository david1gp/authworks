import { A } from "@solidjs/router"
import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { CorvuDialog } from "#ui/interactive/dialog/CorvuDialog.jsx"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { adminPageStateCreate } from "./adminPageStateCreate.js"
import { adminUserStateVariant } from "./adminUserStateVariant.js"

type AdminUserListViewState = ReturnType<typeof adminPageStateCreate>

export function AdminUserListView(props: { readonly detailHrefBase: string; readonly state: AdminUserListViewState }) {
  return (
    <section aria-label={messageTranslate("admin.users.title")} class="grid gap-5">
      <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <p class="max-w-2xl text-sm leading-6 text-muted-foreground">{messageTranslate("admin.users.description")}</p>
        <CorvuDialog
          buttonChildren={messageTranslate("admin.users.create")}
          description={messageTranslate("admin.users.createDescription")}
          onOpenChange={props.state.createOpen.set}
          open={props.state.createOpen.get()}
          title={messageTranslate("admin.users.create")}
          variant="filledBlue"
        >
          <form class="grid gap-4" onSubmit={props.state.userCreateSubmit}>
            <div class="grid gap-2">
              <Label for="admin-user-email">{messageTranslate("admin.users.email")}</Label>
              <Input
                id="admin-user-email"
                onInput={(event) => props.state.createEmail.set(event.currentTarget.value)}
                type="email"
                value={props.state.createEmail.get()}
              />
            </div>
            <div class="grid gap-2">
              <Label for="admin-user-name">{messageTranslate("admin.users.userName")}</Label>
              <Input
                id="admin-user-name"
                onInput={(event) => props.state.createUserName.set(event.currentTarget.value)}
                value={props.state.createUserName.get()}
              />
            </div>
            <div class="grid gap-2">
              <Label for="admin-user-display-name">{messageTranslate("admin.users.displayName")}</Label>
              <Input
                id="admin-user-display-name"
                onInput={(event) => props.state.createDisplayName.set(event.currentTarget.value)}
                value={props.state.createDisplayName.get()}
              />
            </div>
            <Show when={props.state.validationMessage()}>
              {(message) => (
                <p class="text-sm text-danger" role="alert">
                  {message()}
                </p>
              )}
            </Show>
            <Button type="submit" variant="filledBlue">
              {messageTranslate("admin.users.createSubmit")}
            </Button>
          </form>
        </CorvuDialog>
      </div>

      <Show when={props.state.notice()}>
        {(notice) => (
          <p class="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900" role="status">
            {notice()}
          </p>
        )}
      </Show>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="grid gap-2">
          <Label class="sr-only" for="admin-user-search">
            {messageTranslate("admin.users.search")}
          </Label>
          <Input
            class="w-72 max-w-full"
            id="admin-user-search"
            onInput={(event) => props.state.searchTerm.set(event.currentTarget.value)}
            placeholder={messageTranslate("admin.users.searchPlaceholder")}
            value={props.state.searchTerm.get()}
          />
        </div>
        <span class="text-sm text-muted-foreground">
          {messageTranslate("admin.users.count", { count: props.state.users().length })}
        </span>
      </div>

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
                <TableHead>{messageTranslate("admin.users.userName")}</TableHead>
                <TableHead>{messageTranslate("admin.users.email")}</TableHead>
                <TableHead>{messageTranslate("admin.users.verification")}</TableHead>
                <TableHead>{messageTranslate("admin.users.state")}</TableHead>
                <TableHead>{messageTranslate("admin.users.createdAt")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={props.state.users()}>
                {(item) => (
                  <TableRow>
                    <TableCell class="font-medium">
                      <A class="text-accent hover:underline" href={`${props.detailHrefBase}/${item.id}`}>
                        {item.userName}
                      </A>
                    </TableCell>
                    <TableCell>{item.email}</TableCell>
                    <TableCell>
                      <Badge variant={item.emailVerified ? "filledGreen" : "subtle"}>
                        {item.emailVerified
                          ? messageTranslate("admin.users.verified")
                          : messageTranslate("admin.users.unverified")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={adminUserStateVariant(item.state)}>{item.state}</Badge>
                    </TableCell>
                    <TableCell>{localeDateFormat(item.createdAt, { dateStyle: "medium" })}</TableCell>
                  </TableRow>
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
