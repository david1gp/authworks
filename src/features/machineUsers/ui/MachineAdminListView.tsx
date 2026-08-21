import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { CorvuDialog } from "#ui/interactive/dialog/CorvuDialog.jsx"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { MachineAdminNotice } from "./MachineAdminNotice.js"
import { MachineAdminPagination } from "./MachineAdminPagination.js"
import { MachineAdminSecretPanel } from "./MachineAdminSecretPanel.js"
import { MachineAdminStateBoundary } from "./MachineAdminStateBoundary.js"
import { machineUserStatusBadgeVariant } from "./machineUserStatusBadgeVariant.js"
import type { machineAdminListViewStateCreate } from "./machineAdminListViewStateCreate.js"

export function MachineAdminListView(props: { readonly state: ReturnType<typeof machineAdminListViewStateCreate> }) {
  const state = props.state
  return (
    <section class="grid min-w-0 gap-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 class="text-2xl font-semibold tracking-tight">{messageTranslate("admin.machine.users.title")}</h2>
          <p class="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {messageTranslate("admin.machine.users.description")}
          </p>
        </div>
        <CorvuDialog
          buttonChildren={messageTranslate("admin.machine.users.create")}
          description={messageTranslate("admin.machine.users.createDescription")}
          onOpenChange={state.createOpenSet}
          open={state.createOpen()}
          title={messageTranslate("admin.machine.users.create")}
          variant="filledBlue"
        >
          <form class="grid gap-4" onSubmit={state.createSubmit}>
            <div class="grid gap-2">
              <Label for="machine-user-display-name">{messageTranslate("admin.machine.users.displayName")}</Label>
              <Input
                id="machine-user-display-name"
                onInput={(event) => state.displayName.set(event.currentTarget.value)}
                value={state.displayName.get()}
              />
            </div>
            <div class="grid gap-2">
              <Label for="machine-user-user-name">{messageTranslate("admin.machine.users.userName")}</Label>
              <Input
                class="font-mono"
                id="machine-user-user-name"
                onInput={(event) => state.userName.set(event.currentTarget.value)}
                value={state.userName.get()}
              />
              <p class="text-xs text-muted-foreground">{messageTranslate("admin.machine.users.userNameHint")}</p>
            </div>
            <div class="grid gap-2">
              <Label for="machine-user-scopes">{messageTranslate("admin.machine.users.scopes")}</Label>
              <Input
                class="font-mono"
                id="machine-user-scopes"
                onInput={(event) => state.scopes.set(event.currentTarget.value)}
                value={state.scopes.get()}
              />
              <p class="text-xs text-muted-foreground">{messageTranslate("admin.machine.users.scopesHint")}</p>
            </div>
            <Show when={state.formError()}>
              {(message) => (
                <p class="text-sm text-danger" role="alert">
                  {message()}
                </p>
              )}
            </Show>
            <p class="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              {messageTranslate("admin.machine.users.createSecretHint")}
            </p>
            <Button disabled={state.page.pendingId() !== undefined} type="submit" variant="filledBlue">
              {messageTranslate("common.save")}
            </Button>
          </form>
        </CorvuDialog>
      </div>

      <MachineAdminNotice notice={state.page.notice()} />
      <Show when={state.page.issuedSecret()}>
        {(issued) => <MachineAdminSecretPanel issued={issued()} onAcknowledge={state.page.issuedSecretAcknowledge} />}
      </Show>

      <MachineAdminStateBoundary
        emptyDetail={messageTranslate("admin.machine.users.empty")}
        error={state.page.error()}
        onRetry={state.page.reload}
        status={state.page.status()}
      >
        <CardWrapper class="min-w-0">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Label class="sr-only" for="machine-user-search">
              {messageTranslate("admin.machine.users.search")}
            </Label>
            <Input
              class="max-w-sm"
              id="machine-user-search"
              onInput={(event) => state.searchSet(event.currentTarget.value)}
              placeholder={messageTranslate("admin.machine.users.search")}
              value={state.search()}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messageTranslate("admin.machine.users.displayName")}</TableHead>
                <TableHead>{messageTranslate("admin.machine.users.userName")}</TableHead>
                <TableHead>{messageTranslate("admin.machine.users.scopes")}</TableHead>
                <TableHead>{messageTranslate("admin.machine.status")}</TableHead>
                <TableHead>{messageTranslate("admin.machine.updated")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={state.filteredMachineUsers()}>
                {(machineUser) => (
                  <TableRow class="cursor-pointer" onClick={() => state.machineUserOpen(machineUser.id)}>
                    <TableCell class="font-medium">{machineUser.displayName}</TableCell>
                    <TableCell class="font-mono text-xs">{machineUser.userName}</TableCell>
                    <TableCell class="max-w-64 truncate font-mono text-xs">{machineUser.scopes.join(", ")}</TableCell>
                    <TableCell>
                      <Badge variant={machineUserStatusBadgeVariant(machineUser.status)}>{machineUser.status}</Badge>
                    </TableCell>
                    <TableCell>{localeDateFormat(machineUser.updatedAt, { dateStyle: "medium" })}</TableCell>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>
          <MachineAdminPagination
            hasNext={state.page.hasNextPage()}
            hasPrevious={state.page.hasPreviousPage()}
            onNext={state.page.pageNext}
            onPrevious={state.page.pagePrevious}
          />
        </CardWrapper>
      </MachineAdminStateBoundary>
    </section>
  )
}
