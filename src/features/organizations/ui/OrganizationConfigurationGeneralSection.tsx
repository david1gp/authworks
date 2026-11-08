import { mdiCancel } from "@adaptive-ds/mdi/mdiCancel.js"
import { mdiCheckCircle } from "@adaptive-ds/mdi/mdiCheckCircle.js"
import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiDelete } from "@adaptive-ds/mdi/mdiDelete.js"
import { For, Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedCopyableId } from "../../../ui/authenticated/AuthenticatedCopyableId.js"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedRelativeTime } from "../../../ui/authenticated/AuthenticatedRelativeTime.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedSettingsList } from "../../../ui/authenticated/AuthenticatedSettingsList.js"
import { AuthenticatedSettingsRow } from "../../../ui/authenticated/AuthenticatedSettingsRow.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OrganizationStatus } from "../public/organizationStatusSchema.js"
import { OrganizationAdminNotice } from "./OrganizationAdminNotice.js"
import { OrganizationAdminState } from "./OrganizationAdminState.js"
import type { organizationAdminPageStateCreate } from "./organizationAdminPageStateCreate.js"
import type { organizationAdminScreenStateCreate } from "./organizationAdminScreenStateCreate.js"
import { organizationAdminStatusTone } from "./organizationAdminStatusTone.js"

type ConfigurationPage = ReturnType<typeof organizationAdminPageStateCreate>
type ConfigurationScreen = ReturnType<typeof organizationAdminScreenStateCreate>

/** General section: rename, status explanation, danger zone, and secondary identifiers. */
export function OrganizationConfigurationGeneralSection(props: {
  readonly canEdit: boolean
  readonly page: ConfigurationPage
  readonly screen: ConfigurationScreen
}) {
  const confirmName = createSignalObject("")
  const confirmAction = createSignalObject<OrganizationStatus | undefined>(undefined)
  const removeDialog = () => confirmAction.get() === "removed"
  const lifecycleConfirm = (status: OrganizationStatus) => {
    confirmName.set("")
    confirmAction.set(status)
  }
  const lifecycleRun = () => {
    const action = confirmAction.get()
    if (action === undefined) return
    confirmAction.set(undefined)
    void props.page.organizationLifecycleSet(action)
  }

  return (
    <OrganizationAdminState
      emptyDetail={messageTranslate("admin.organizations.configuration.generalDescription")}
      error={props.page.error()}
      onRetry={props.page.reload}
      status={props.page.status()}
    >
      <OrganizationAdminNotice notice={props.page.notice()} />
      <Show when={props.page.organization()}>
        {(organization) => (
          <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
            <div class="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <AuthenticatedStatus
                label={messageTranslate(`admin.organizations.statusValue.${organization().status}`)}
                tone={organizationAdminStatusTone(organization().status)}
              />
              <AuthenticatedCopyableId
                label={messageTranslate("admin.configuration.identifier")}
                value={organization().id}
              />
              <span>
                {messageTranslate("admin.configuration.created")}:{" "}
                <AuthenticatedRelativeTime value={organization().createdAt} />
              </span>
            </div>

            <AuthenticatedSection
              description={messageTranslate("admin.configuration.nameDescription")}
              title={messageTranslate("admin.configuration.nameTitle")}
            >
              <form class="grid gap-3 px-4 py-3" onSubmit={props.screen.organizationRenameSubmit}>
                <AuthenticatedSettingsList>
                  <AuthenticatedSettingsRow
                    label={messageTranslate("admin.organizations.list.name")}
                    htmlFor="configuration-organization-name"
                  >
                    <div class="flex items-center gap-2">
                      <AuthenticatedInput
                        disabled={!props.canEdit}
                        id="configuration-organization-name"
                        onInput={(event) => props.screen.form.detailName.set(event.currentTarget.value)}
                        value={props.screen.form.detailName.get()}
                      />
                      <AuthenticatedButton
                        disabled={!props.canEdit || props.page.pendingId() !== undefined}
                        icon={mdiContentSave}
                        type="submit"
                        variant="filledBlue"
                      >
                        {messageTranslate("common.save")}
                      </AuthenticatedButton>
                    </div>
                  </AuthenticatedSettingsRow>
                </AuthenticatedSettingsList>
              </form>
            </AuthenticatedSection>

            <AuthenticatedSection
              description={messageTranslate("admin.organizations.metadata.description")}
              title={messageTranslate("admin.organizations.metadata.title")}
            >
              <div class="grid gap-3 px-4 py-3">
                <Show
                  when={props.page.metadata().length > 0}
                  fallback={
                    <p class="text-sm text-muted-foreground">
                      {messageTranslate("admin.organizations.metadata.empty")}
                    </p>
                  }
                >
                  <div class="grid gap-2">
                    <div
                      aria-hidden="true"
                      class="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 px-3 sm:grid"
                    >
                      <p class="text-[0.8125rem] font-medium">{messageTranslate("admin.organizations.metadata.key")}</p>
                      <p class="text-[0.8125rem] font-medium">
                        {messageTranslate("admin.organizations.metadata.value")}
                      </p>
                      <span />
                    </div>
                    <For each={props.page.metadata()}>
                      {(entry) => {
                        const draft = () => props.screen.form.metadataEdits.get()[entry.key]
                        const dirty = () => draft() !== undefined && draft() !== entry.value
                        const busy = () => props.page.pendingId() === `metadata:${entry.key}`
                        return (
                          <form
                            class="grid min-w-0 items-center gap-2 rounded-control border border-line-subtle px-3 py-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                            onSubmit={(event) => {
                              event.preventDefault()
                              props.screen.metadataEditSubmit(entry.key, entry.value)
                            }}
                          >
                            <p class="min-w-0 truncate font-mono text-[0.8125rem] font-medium" title={entry.key}>
                              {entry.key}
                            </p>
                            <AuthenticatedInput
                              disabled={!props.canEdit}
                              id={`configuration-metadata-${entry.key}`}
                              onInput={(event) => props.screen.metadataEditInput(entry.key, event.currentTarget.value)}
                              value={draft() ?? entry.value}
                            />
                            <Show when={props.canEdit}>
                              <div class="flex gap-2">
                                <AuthenticatedButton
                                  disabled={!dirty() || busy()}
                                  icon={mdiContentSave}
                                  type="submit"
                                  variant="filledBlue"
                                >
                                  {messageTranslate("common.save")}
                                </AuthenticatedButton>
                                <AuthenticatedButton
                                  disabled={busy()}
                                  icon={mdiDelete}
                                  onClick={() => props.screen.metadataRemove(entry.key)}
                                  type="button"
                                  variant="outlineRed"
                                >
                                  {messageTranslate("admin.organizations.metadata.remove")}
                                </AuthenticatedButton>
                              </div>
                            </Show>
                          </form>
                        )
                      }}
                    </For>
                  </div>
                </Show>
                <Show when={props.screen.form.validationMessage.get()}>
                  {(validationMessage) => <AuthenticatedNotice message={validationMessage()} tone="danger" />}
                </Show>
                <Show when={props.canEdit}>
                  <form
                    class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                    onSubmit={props.screen.metadataSubmit}
                  >
                    <div class="grid min-w-0 gap-1.5">
                      <Label class="text-[0.8125rem] font-medium" for="configuration-metadata-key">
                        {messageTranslate("admin.organizations.metadata.key")}
                      </Label>
                      <AuthenticatedInput
                        id="configuration-metadata-key"
                        onInput={(event) => props.screen.metadataKeySet(event.currentTarget.value)}
                        value={props.screen.form.metadataKey.get()}
                      />
                    </div>
                    <div class="grid min-w-0 gap-1.5">
                      <Label class="text-[0.8125rem] font-medium" for="configuration-metadata-value">
                        {messageTranslate("admin.organizations.metadata.value")}
                      </Label>
                      <AuthenticatedInput
                        id="configuration-metadata-value"
                        onInput={(event) => props.screen.metadataValueSet(event.currentTarget.value)}
                        value={props.screen.form.metadataValue.get()}
                      />
                    </div>
                    <AuthenticatedButton
                      disabled={props.page.pendingId() !== undefined}
                      icon={mdiContentSave}
                      type="submit"
                      variant="filledBlue"
                    >
                      {messageTranslate("admin.organizations.metadata.save")}
                    </AuthenticatedButton>
                  </form>
                </Show>
              </div>
            </AuthenticatedSection>

            <Show when={props.canEdit}>
              <AuthenticatedSection
                description={messageTranslate("admin.configuration.dangerDescription")}
                title={messageTranslate("admin.configuration.dangerTitle")}
              >
                <div class="flex flex-wrap gap-2 px-4 py-3">
                  <Show when={organization().status !== "active"}>
                    <AuthenticatedButton
                      disabled={props.page.pendingId() !== undefined}
                      icon={mdiCheckCircle}
                      onClick={() => lifecycleConfirm("active")}
                      variant="outline"
                    >
                      {messageTranslate("admin.configuration.reactivate")}
                    </AuthenticatedButton>
                  </Show>
                  <Show when={organization().status === "active"}>
                    <AuthenticatedButton
                      disabled={props.page.pendingId() !== undefined}
                      icon={mdiCancel}
                      onClick={() => lifecycleConfirm("inactive")}
                      variant="outline"
                    >
                      {messageTranslate("admin.configuration.deactivate")}
                    </AuthenticatedButton>
                  </Show>
                  <Show when={organization().status !== "removed"}>
                    <AuthenticatedButton
                      disabled={props.page.pendingId() !== undefined}
                      icon={mdiDelete}
                      onClick={() => lifecycleConfirm("removed")}
                      variant="outlineRed"
                    >
                      {messageTranslate("admin.configuration.remove")}
                    </AuthenticatedButton>
                  </Show>
                </div>
              </AuthenticatedSection>
            </Show>
          </div>
        )}
      </Show>

      <AuthenticatedDialog
        description={
          removeDialog()
            ? messageTranslate("admin.organizations.lifecycle.removeConfirm")
            : messageTranslate("admin.configuration.dangerDescription")
        }
        disabled={removeDialog() && confirmName.get().trim() !== (props.page.organization()?.name ?? "")}
        onOpenChange={(open) => {
          if (!open) confirmAction.set(undefined)
        }}
        open={confirmAction.get() !== undefined}
        title={
          removeDialog()
            ? messageTranslate("admin.configuration.remove")
            : confirmAction.get() === "inactive"
              ? messageTranslate("admin.configuration.deactivate")
              : messageTranslate("admin.configuration.reactivate")
        }
      >
        <div class="grid gap-3">
          <Show when={removeDialog()}>
            <div class="grid gap-1.5">
              <Label for="configuration-confirm-name">{messageTranslate("admin.configuration.typeName")}</Label>
              <AuthenticatedInput
                id="configuration-confirm-name"
                onInput={(event) => confirmName.set(event.currentTarget.value)}
                value={confirmName.get()}
              />
              <Show
                when={
                  confirmName.get().length > 0 && confirmName.get().trim() !== (props.page.organization()?.name ?? "")
                }
              >
                <AuthenticatedNotice message={messageTranslate("admin.configuration.typeNameInvalid")} tone="danger" />
              </Show>
            </div>
          </Show>
          <div class="flex justify-end gap-2">
            <AuthenticatedButton onClick={() => confirmAction.set(undefined)} variant="outline">
              {messageTranslate("common.cancel")}
            </AuthenticatedButton>
            <AuthenticatedButton
              disabled={removeDialog() && confirmName.get().trim() !== (props.page.organization()?.name ?? "")}
              icon={removeDialog() ? mdiDelete : undefined}
              onClick={lifecycleRun}
              variant="filledRed"
            >
              {messageTranslate("common.continue")}
            </AuthenticatedButton>
          </div>
        </div>
      </AuthenticatedDialog>
    </OrganizationAdminState>
  )
}
