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
import type { Organization } from "../public/organizationSchema.js"
import { OrganizationAdminNotice } from "./OrganizationAdminNotice.js"
import { OrganizationAdminState } from "./OrganizationAdminState.js"
import { organizationAdminStatusTone } from "./organizationAdminStatusTone.js"
import type { OrganizationAdminStatus } from "./organizationAdminStatusSchema.js"

export function OrganizationAdminListView(props: {
  readonly createName: string
  readonly createOpen: boolean
  readonly detailHrefBuild: (organizationId: string) => string
  readonly error?: string
  readonly nextPageAvailable: boolean
  readonly notice?: string
  readonly onCreateNameInput: (value: string) => void
  readonly onCreateOpenChange: (open: boolean) => void
  readonly onCreateSubmit: (event: SubmitEvent) => void
  readonly onNextPage: () => void
  readonly onPreviousPage: () => void
  readonly onRetry: () => void
  readonly onSearchInput: (value: string) => void
  readonly organizations: readonly Organization[]
  readonly pendingId?: string
  readonly previousPageAvailable: boolean
  readonly search: string
  readonly status: OrganizationAdminStatus
  readonly validationMessage?: string
}) {
  return (
    <section aria-label={messageTranslate("admin.organizations.list.title")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <AuthenticatedToolbar
        actions={
          <AuthenticatedDialog
            class="h-8 text-xs"
            description={messageTranslate("admin.organizations.list.description")}
            onOpenChange={props.onCreateOpenChange}
            open={props.createOpen}
            title={messageTranslate("admin.organizations.list.create")}
            triggerLabel={messageTranslate("admin.organizations.list.create")}
            variant="filledBlue"
          >
            <form class="grid gap-3" onSubmit={props.onCreateSubmit}>
              <div class="grid gap-1">
                <Label for="organization-name">{messageTranslate("admin.organizations.list.name")}</Label>
                <Input
                  id="organization-name"
                  onInput={(event) => props.onCreateNameInput(event.currentTarget.value)}
                  value={props.createName}
                />
              </div>
              <Show when={props.validationMessage}>
                {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
              </Show>
              <Button disabled={props.pendingId === "organization:create"} type="submit" variant="filledBlue">
                {messageTranslate("common.save")}
              </Button>
            </form>
          </AuthenticatedDialog>
        }
        label={messageTranslate("admin.organizations.list.title")}
      >
        <Label class="sr-only" for="organization-search">
          {messageTranslate("admin.organizations.list.search")}
        </Label>
        <Input
          class="h-8 w-72 max-w-full text-sm"
          id="organization-search"
          onInput={(event) => props.onSearchInput(event.currentTarget.value)}
          placeholder={messageTranslate("admin.organizations.list.search")}
          value={props.search}
        />
      </AuthenticatedToolbar>

      <OrganizationAdminNotice notice={props.notice} />

      <OrganizationAdminState
        emptyDetail={messageTranslate("admin.organizations.list.empty")}
        error={props.error}
        onRetry={props.onRetry}
        status={props.status}
      >
        <AuthenticatedSection>
          <AuthenticatedRecordList label={messageTranslate("admin.organizations.list.title")}>
            <For each={props.organizations}>
              {(organization) => (
                <AuthenticatedRecordItem
                  fields={[
                    {
                      label: messageTranslate("admin.organizations.detail.created"),
                      value: localeDateFormat(organization.createdAt, { dateStyle: "medium" }),
                    },
                  ]}
                  status={
                    <AuthenticatedStatus
                      label={messageTranslate(`admin.organizations.statusValue.${organization.status}`)}
                      tone={organizationAdminStatusTone(organization.status)}
                    />
                  }
                  title={
                    <A
                      class="min-w-0 truncate text-accent hover:underline"
                      href={props.detailHrefBuild(organization.id)}
                    >
                      {organization.name}
                    </A>
                  }
                />
              )}
            </For>
          </AuthenticatedRecordList>

          <Table
            aria-label={messageTranslate("admin.organizations.list.title")}
            class={authenticatedTableClasses.tableWide}
            tabIndex={0}
          >
            <TableHeader class={authenticatedTableClasses.header}>
              <TableRow>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.organizations.list.name")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.organizations.status")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.organizations.detail.created")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={props.organizations}>
                {(organization) => (
                  <TableRow class={authenticatedTableClasses.row}>
                    <TableCell class={authenticatedTableClasses.cell}>
                      <A
                        class="min-w-0 truncate font-medium text-accent hover:underline"
                        href={props.detailHrefBuild(organization.id)}
                      >
                        {organization.name}
                      </A>
                    </TableCell>
                    <TableCell class={authenticatedTableClasses.cell}>
                      <AuthenticatedStatus
                        label={messageTranslate(`admin.organizations.statusValue.${organization.status}`)}
                        tone={organizationAdminStatusTone(organization.status)}
                      />
                    </TableCell>
                    <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap tabular-nums`}>
                      {localeDateFormat(organization.createdAt, { dateStyle: "medium" })}
                    </TableCell>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>

          <AuthenticatedPagination
            nextAvailable={props.nextPageAvailable}
            onNext={props.onNextPage}
            onPrevious={props.onPreviousPage}
            previousAvailable={props.previousPageAvailable}
          />
        </AuthenticatedSection>
      </OrganizationAdminState>
    </section>
  )
}
