import { A } from "@solidjs/router"
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
import type { Organization } from "../public/organizationSchema.js"
import type { OrganizationStatus } from "../public/organizationStatusSchema.js"
import { OrganizationAdminNotice } from "./OrganizationAdminNotice.js"
import { OrganizationAdminPagination } from "./OrganizationAdminPagination.js"
import { OrganizationAdminState } from "./OrganizationAdminState.js"
import type { OrganizationAdminStatus } from "./organizationAdminStatusSchema.js"
import { organizationAdminStatusVariant } from "./organizationAdminStatusVariant.js"

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
    <section class="grid gap-5">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">{messageTranslate("admin.organizations.list.title")}</h1>
          <p class="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {messageTranslate("admin.organizations.list.description")}
          </p>
        </div>
        <CorvuDialog
          buttonChildren={messageTranslate("admin.organizations.list.create")}
          description={messageTranslate("admin.organizations.list.description")}
          onOpenChange={props.onCreateOpenChange}
          open={props.createOpen}
          title={messageTranslate("admin.organizations.list.create")}
          variant="filledBlue"
        >
          <form class="grid gap-4" onSubmit={props.onCreateSubmit}>
            <div class="grid gap-2">
              <Label for="organization-name">{messageTranslate("admin.organizations.list.name")}</Label>
              <Input
                id="organization-name"
                onInput={(event) => props.onCreateNameInput(event.currentTarget.value)}
                value={props.createName}
              />
            </div>
            <Show when={props.validationMessage}>
              {(message) => (
                <p class="text-sm text-danger" role="alert">
                  {message()}
                </p>
              )}
            </Show>
            <Button disabled={props.pendingId === "organization:create"} type="submit" variant="filledBlue">
              {messageTranslate("common.save")}
            </Button>
          </form>
        </CorvuDialog>
      </div>
      <OrganizationAdminNotice notice={props.notice} />
      <OrganizationAdminState
        emptyDetail={messageTranslate("admin.organizations.list.empty")}
        error={props.error}
        onRetry={props.onRetry}
        status={props.status}
      >
        <CardWrapper>
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Label class="sr-only" for="organization-search">
              {messageTranslate("admin.organizations.list.search")}
            </Label>
            <Input
              class="max-w-sm"
              id="organization-search"
              onInput={(event) => props.onSearchInput(event.currentTarget.value)}
              placeholder={messageTranslate("admin.organizations.list.search")}
              value={props.search}
            />
          </div>
          <Table aria-label={messageTranslate("admin.organizations.list.title")} tabIndex={0}>
            <TableHeader>
              <TableRow>
                <TableHead>{messageTranslate("admin.organizations.list.name")}</TableHead>
                <TableHead>{messageTranslate("admin.organizations.status")}</TableHead>
                <TableHead>{messageTranslate("admin.organizations.detail.created")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={props.organizations}>
                {(organization) => (
                  <TableRow>
                    <TableCell class="font-medium">
                      <A class="text-accent hover:underline" href={props.detailHrefBuild(organization.id)}>
                        {organization.name}
                      </A>
                    </TableCell>
                    <TableCell>
                      <Badge variant={organizationAdminStatusVariant(organization.status as OrganizationStatus)}>
                        {messageTranslate(`admin.organizations.statusValue.${organization.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>{localeDateFormat(organization.createdAt, { dateStyle: "medium" })}</TableCell>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>
          <OrganizationAdminPagination
            nextAvailable={props.nextPageAvailable}
            onNext={props.onNextPage}
            onPrevious={props.onPreviousPage}
            previousAvailable={props.previousPageAvailable}
          />
        </CardWrapper>
      </OrganizationAdminState>
    </section>
  )
}
