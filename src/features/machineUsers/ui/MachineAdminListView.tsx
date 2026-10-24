import { mdiArrowRight } from "@adaptive-ds/mdi/mdiArrowRight.js"
import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiPlus } from "@adaptive-ds/mdi/mdiPlus.js"
import { For, Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
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
import type { MachineUser } from "../public/machineUserSchema.js"
import { MachineAdminNotice } from "./MachineAdminNotice.js"
import { MachineAdminScopeList } from "./MachineAdminScopeList.js"
import { MachineAdminSecretPanel } from "./MachineAdminSecretPanel.js"
import { MachineAdminStateBoundary } from "./MachineAdminStateBoundary.js"
import type { machineAdminListViewStateCreate } from "./machineAdminListViewStateCreate.js"
import { machineUserStatusTone } from "./machineUserStatusTone.js"

export function MachineAdminListView(props: { readonly state: ReturnType<typeof machineAdminListViewStateCreate> }) {
  const state = props.state
  const machineUserStatus = (machineUser: MachineUser) => (
    <AuthenticatedStatus
      label={messageTranslate(`admin.machine.statusValue.${machineUser.status}`)}
      tone={machineUserStatusTone(machineUser.status)}
    />
  )
  const machineUserOpenButton = (machineUser: MachineUser) => (
    <button
      class="text-left font-medium text-accent hover:underline"
      onClick={() => state.machineUserOpen(machineUser.id)}
      type="button"
    >
      {machineUser.displayName}
      <Icon class="ml-1 inline size-4" path={mdiArrowRight} />
    </button>
  )

  return (
    <section aria-label={messageTranslate("admin.machine.users.title")} class="grid min-w-0 gap-5 [&>*]:min-w-0">
      <p class="text-sm text-muted-foreground">{messageTranslate("admin.machine.users.description")}</p>
      <AuthenticatedToolbar
        actions={
          <AuthenticatedDialog
            description={messageTranslate("admin.machine.users.createDescription")}
            onOpenChange={state.createOpenSet}
            open={state.createOpen()}
            title={messageTranslate("admin.machine.users.create")}
            trigger={
              <AuthenticatedButton icon={mdiPlus} variant="filledBlue">
                {messageTranslate("admin.machine.users.create")}
              </AuthenticatedButton>
            }
          >
            <form
              class="grid max-w-3xl gap-4 [&_label]:text-[0.8125rem] [&_label]:font-medium [&_div.grid]:gap-y-1.5"
              onSubmit={state.createSubmit}
            >
              <div class="grid items-start gap-3 sm:grid-cols-2">
                <div class="grid min-w-0 gap-1">
                  <Label for="machine-user-display-name">{messageTranslate("admin.machine.users.displayName")}</Label>
                  <AuthenticatedInput
                    id="machine-user-display-name"
                    onInput={(event) => state.displayName.set(event.currentTarget.value)}
                    value={state.displayName.get()}
                  />
                </div>
                <div class="grid min-w-0 gap-1">
                  <Label for="machine-user-user-name">{messageTranslate("admin.machine.users.userName")}</Label>
                  <AuthenticatedInput
                    class="font-mono text-xs"
                    id="machine-user-user-name"
                    onInput={(event) => state.userName.set(event.currentTarget.value)}
                    value={state.userName.get()}
                  />
                  <p class="text-xs leading-4 text-muted-foreground">
                    {messageTranslate("admin.machine.users.userNameHint")}
                  </p>
                </div>
              </div>

              <div class="grid min-w-0 gap-1">
                <Label for="machine-user-scopes">{messageTranslate("admin.machine.users.scopes")}</Label>
                <AuthenticatedInput
                  class="font-mono text-xs"
                  id="machine-user-scopes"
                  onInput={(event) => state.scopes.set(event.currentTarget.value)}
                  value={state.scopes.get()}
                />
                <p class="text-xs leading-4 text-muted-foreground">
                  {messageTranslate("admin.machine.users.scopesHint")}
                </p>
              </div>

              <Show when={state.formError()}>
                {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
              </Show>

              {/* Creation issues client credentials once, so the warning precedes the action. */}
              <p class="rounded-control border border-warning/35 bg-warning-soft px-3.5 py-3 text-xs leading-5 text-warning">
                {messageTranslate("admin.machine.users.createSecretHint")}
              </p>

              <div class="flex justify-end gap-2">
                <AuthenticatedButton
                  disabled={state.page.pendingId() !== undefined}
                  icon={mdiContentSave}
                  type="submit"
                  variant="filledBlue"
                >
                  {messageTranslate("common.save")}
                </AuthenticatedButton>
              </div>
            </form>
          </AuthenticatedDialog>
        }
        label={messageTranslate("admin.machine.users.title")}
      >
        <Label class="sr-only" for="machine-user-search">
          {messageTranslate("admin.machine.users.search")}
        </Label>
        <AuthenticatedInput
          class="w-full sm:max-w-xs"
          id="machine-user-search"
          onInput={(event) => state.searchSet(event.currentTarget.value)}
          placeholder={messageTranslate("admin.machine.users.search")}
          value={state.search()}
        />
      </AuthenticatedToolbar>

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
        <AuthenticatedSection>
          <AuthenticatedRecordList label={messageTranslate("admin.machine.users.title")}>
            <For each={state.filteredMachineUsers()}>
              {(machineUser) => (
                <AuthenticatedRecordItem
                  fields={[
                    {
                      identifier: true,
                      label: messageTranslate("admin.machine.users.userName"),
                      value: machineUser.userName,
                    },
                    {
                      label: messageTranslate("admin.machine.updated"),
                      value: localeDateFormat(machineUser.updatedAt, { dateStyle: "medium" }),
                    },
                    {
                      label: messageTranslate("admin.machine.users.scopes"),
                      value: (
                        <MachineAdminScopeList
                          empty={messageTranslate("admin.machine.users.noScopes")}
                          scopes={machineUser.scopes}
                        />
                      ),
                      wide: true,
                    },
                  ]}
                  status={machineUserStatus(machineUser)}
                  title={machineUserOpenButton(machineUser)}
                />
              )}
            </For>
          </AuthenticatedRecordList>

          <Table
            aria-label={messageTranslate("admin.machine.users.title")}
            class={authenticatedTableClasses.tableWide}
            tabIndex={0}
          >
            <TableHeader class={authenticatedTableClasses.header}>
              <TableRow>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.machine.users.displayName")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.machine.users.userName")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.machine.users.scopes")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.machine.status")}</TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.machine.updated")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={state.filteredMachineUsers()}>
                {(machineUser) => (
                  <TableRow class={authenticatedTableClasses.row}>
                    <TableCell class={authenticatedTableClasses.cell}>{machineUserOpenButton(machineUser)}</TableCell>
                    {/* The user name doubles as the client ID, so the exact value stays inspectable. */}
                    <TableCell class={authenticatedTableClasses.identifier} title={machineUser.userName}>
                      {machineUser.userName}
                    </TableCell>
                    <TableCell class={`${authenticatedTableClasses.cell} max-w-[20rem]`}>
                      <MachineAdminScopeList
                        empty={messageTranslate("admin.machine.users.noScopes")}
                        scopes={machineUser.scopes}
                      />
                    </TableCell>
                    <TableCell class={authenticatedTableClasses.cell}>{machineUserStatus(machineUser)}</TableCell>
                    <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap tabular-nums`}>
                      {localeDateFormat(machineUser.updatedAt, { dateStyle: "medium" })}
                    </TableCell>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>

          <AuthenticatedPagination
            nextAvailable={state.page.hasNextPage()}
            onNext={state.page.pageNext}
            onPrevious={state.page.pagePrevious}
            previousAvailable={state.page.hasPreviousPage()}
          />
        </AuthenticatedSection>
      </MachineAdminStateBoundary>
    </section>
  )
}
