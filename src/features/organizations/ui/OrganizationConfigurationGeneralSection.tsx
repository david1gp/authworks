import { mdiCancel } from "@adaptive-ds/mdi/mdiCancel.js"
import { mdiCheckCircle } from "@adaptive-ds/mdi/mdiCheckCircle.js"
import { mdiContentCopy } from "@adaptive-ds/mdi/mdiContentCopy.js"
import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiDelete } from "@adaptive-ds/mdi/mdiDelete.js"
import { Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
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
  const copied = createSignalObject(false)

  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      copied.set(true)
      setTimeout(() => copied.set(false), 2000)
    } catch {
      copied.set(false)
    }
  }

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
          <div class="grid min-w-0 gap-5 [&>*]:min-w-0">
            <AuthenticatedSection
              actions={
                <AuthenticatedStatus
                  label={messageTranslate(`admin.organizations.statusValue.${organization().status}`)}
                  tone={organizationAdminStatusTone(organization().status)}
                />
              }
              description={messageTranslate("admin.configuration.statusDescription")}
              title={messageTranslate("admin.configuration.statusTitle")}
            >
              <div class="px-5 py-4">
                <p class="text-sm text-muted-foreground">
                  {organization().status === "active"
                    ? messageTranslate("admin.configuration.statusActive")
                    : organization().status === "inactive"
                      ? messageTranslate("admin.configuration.statusInactive")
                      : messageTranslate("admin.configuration.statusRemoved")}
                </p>
              </div>
            </AuthenticatedSection>

            <AuthenticatedSection
              description={messageTranslate("admin.configuration.nameDescription")}
              title={messageTranslate("admin.configuration.nameTitle")}
            >
              <form class="grid max-w-3xl gap-4 px-5 py-4" onSubmit={props.screen.organizationRenameSubmit}>
                <div class="grid min-w-0 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div class="grid min-w-0 gap-1.5">
                    <Label class="text-[0.8125rem] font-medium" for="configuration-organization-name">
                      {messageTranslate("admin.organizations.list.name")}
                    </Label>
                    <AuthenticatedInput
                      disabled={!props.canEdit}
                      id="configuration-organization-name"
                      onInput={(event) => props.screen.form.detailName.set(event.currentTarget.value)}
                      value={props.screen.form.detailName.get()}
                    />
                  </div>
                  <AuthenticatedButton
                    disabled={!props.canEdit || props.page.pendingId() !== undefined}
                    icon={mdiContentSave}
                    type="submit"
                    variant="filledBlue"
                  >
                    {messageTranslate("common.save")}
                  </AuthenticatedButton>
                </div>
              </form>
            </AuthenticatedSection>

            <AuthenticatedSection
              description={messageTranslate("admin.configuration.metaDescription")}
              title={messageTranslate("admin.configuration.metaTitle")}
            >
              <div class="px-5 py-4">
                <AuthenticatedFieldList
                  columns={3}
                  fields={[
                    {
                      identifier: true,
                      label: messageTranslate("admin.configuration.identifier"),
                      value: organization().id,
                    },
                    {
                      label: messageTranslate("admin.configuration.created"),
                      value: localeDateFormat(organization().createdAt, { dateStyle: "medium", timeStyle: "short" }),
                    },
                  ]}
                />
                <div class="mt-3 flex flex-wrap gap-2">
                  <AuthenticatedButton
                    icon={mdiContentCopy}
                    onClick={() => void copyValue(organization().id)}
                    size="sm"
                    variant="outline"
                  >
                    {copied.get()
                      ? messageTranslate("admin.configuration.copied")
                      : messageTranslate("admin.configuration.copy")}
                  </AuthenticatedButton>
                </div>
              </div>
            </AuthenticatedSection>

            <Show when={props.canEdit}>
              <AuthenticatedSection
                description={messageTranslate("admin.configuration.dangerDescription")}
                title={messageTranslate("admin.configuration.dangerTitle")}
              >
                <div class="flex flex-wrap gap-2 px-5 py-4">
                  <Show when={organization().status !== "active"}>
                    <AuthenticatedButton
                      disabled={props.page.pendingId() !== undefined}
                      icon={mdiCheckCircle}
                      onClick={() => lifecycleConfirm("active")}
                      size="sm"
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
                      size="sm"
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
                      size="sm"
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
        triggerLabel={<span />}
      >
        <div class="grid gap-4">
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
