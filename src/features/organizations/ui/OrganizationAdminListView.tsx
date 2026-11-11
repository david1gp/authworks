import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiPlus } from "@adaptive-ds/mdi/mdiPlus.js"
import { For, Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedCardList } from "../../../ui/authenticated/AuthenticatedCardList.js"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { AuthenticatedPagination } from "../../../ui/authenticated/AuthenticatedPagination.js"
import { AuthenticatedSelect } from "../../../ui/authenticated/AuthenticatedSelect.js"
import { AuthenticatedToolbar } from "../../../ui/authenticated/AuthenticatedToolbar.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { Organization } from "../public/organizationSchema.js"
import { OrganizationAdminCard } from "./OrganizationAdminCard.js"
import { OrganizationAdminNotice } from "./OrganizationAdminNotice.js"
import { OrganizationAdminState } from "./OrganizationAdminState.js"
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
  readonly onStatusInput: (value: string) => void
  readonly organizations: readonly Organization[]
  readonly pendingId?: string
  readonly previousPageAvailable: boolean
  readonly search: string
  readonly status: OrganizationAdminStatus
  readonly statusFilter: string
  readonly validationMessage?: string
}) {
  const statusOptions = () => ["active", "inactive", "all"]
  return (
    <section aria-label={messageTranslate("admin.organizations.list.title")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <AuthenticatedPageHeader
        title={messageTranslate("admin.organizations.list.title")}
        meta={
          <span>
            {props.organizations.length} {messageTranslate("admin.redesign.organizations")}
          </span>
        }
        actions={
          <AuthenticatedDialog
            description={messageTranslate("admin.organizations.list.description")}
            onOpenChange={props.onCreateOpenChange}
            open={props.createOpen}
            title={messageTranslate("admin.organizations.list.create")}
            triggerLabel={messageTranslate("admin.organizations.list.create")}
            triggerIcon={mdiPlus}
            variant="filledBlue"
          >
            <form class="grid gap-3" onSubmit={props.onCreateSubmit}>
              <div class="grid gap-1.5">
                <Label class="text-[0.8125rem] font-medium" for="organization-name">
                  {messageTranslate("admin.organizations.list.name")}
                </Label>
                <AuthenticatedInput
                  id="organization-name"
                  onInput={(event) => props.onCreateNameInput(event.currentTarget.value)}
                  value={props.createName}
                />
              </div>
              <Show when={props.validationMessage}>
                {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
              </Show>
              <div class="flex justify-end gap-2">
                <AuthenticatedButton
                  disabled={props.pendingId === "organization:create"}
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
      />
      <AuthenticatedToolbar label={messageTranslate("admin.organizations.list.title")}>
        <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Label class="sr-only" for="organization-search">
            {messageTranslate("admin.organizations.list.search")}
          </Label>
          <AuthenticatedInput
            class="w-full sm:w-72"
            id="organization-search"
            onInput={(event) => props.onSearchInput(event.currentTarget.value)}
            placeholder={messageTranslate("admin.organizations.list.search")}
            value={props.search}
          />
          <Label class="sr-only" for="organization-status">
            {messageTranslate("admin.organizations.status")}
          </Label>
          <AuthenticatedSelect
            aria-label={messageTranslate("admin.organizations.status")}
            getOptions={statusOptions}
            id="organization-status"
            valueSignal={{ get: () => props.statusFilter, set: props.onStatusInput }}
            valueText={(value) =>
              value === "all"
                ? messageTranslate("admin.organizations.list.statusAll")
                : messageTranslate(`admin.organizations.statusValue.${value as "active" | "inactive"}`)
            }
          />
        </div>
      </AuthenticatedToolbar>

      <OrganizationAdminNotice notice={props.notice} />

      <OrganizationAdminState
        emptyDetail={messageTranslate("admin.organizations.list.empty")}
        error={props.error}
        onRetry={props.onRetry}
        status={props.status}
      >
        <div>
          <AuthenticatedCardList label={messageTranslate("admin.organizations.list.title")}>
            <For each={props.organizations}>
              {(organization) => (
                <OrganizationAdminCard organization={organization} href={props.detailHrefBuild(organization.id)} />
              )}
            </For>
          </AuthenticatedCardList>

          <AuthenticatedPagination
            nextAvailable={props.nextPageAvailable}
            onNext={props.onNextPage}
            onPrevious={props.onPreviousPage}
            previousAvailable={props.previousPageAvailable}
          />
        </div>
      </OrganizationAdminState>
    </section>
  )
}
