import { mdiAutorenew } from "@adaptive-ds/mdi/mdiAutorenew.js"
import { mdiCancel } from "@adaptive-ds/mdi/mdiCancel.js"
import { mdiCheckCircle } from "@adaptive-ds/mdi/mdiCheckCircle.js"
import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiDelete } from "@adaptive-ds/mdi/mdiDelete.js"
import { mdiKeyPlus } from "@adaptive-ds/mdi/mdiKeyPlus.js"
import { mdiPencil } from "@adaptive-ds/mdi/mdiPencil.js"
import { For, Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedChip } from "../../../ui/authenticated/AuthenticatedChip.js"
import { AuthenticatedCopyableId } from "../../../ui/authenticated/AuthenticatedCopyableId.js"
import { AuthenticatedDetailHeader } from "../../../ui/authenticated/AuthenticatedDetailHeader.js"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedRelativeTime } from "../../../ui/authenticated/AuthenticatedRelativeTime.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { MachineAdminCredentialForm } from "./MachineAdminCredentialForm.js"
import { MachineAdminCredentialTable } from "./MachineAdminCredentialTable.js"
import { MachineAdminNotice } from "./MachineAdminNotice.js"
import { MachineAdminSecretPanel } from "./MachineAdminSecretPanel.js"
import { MachineAdminStateBoundary } from "./MachineAdminStateBoundary.js"
import type { machineAdminDetailViewStateCreate } from "./machineAdminDetailViewStateCreate.js"
import { machineUserStatusTone } from "./machineUserStatusTone.js"

export function MachineAdminDetailView(props: {
  readonly state: ReturnType<typeof machineAdminDetailViewStateCreate>
}) {
  const state = props.state
  return (
    <section aria-label={messageTranslate("admin.machine.users.detailTitle")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
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
        <Show when={state.page.machineUser()}>
          {(machineUser) => (
            <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
              <AuthenticatedDetailHeader
                title={machineUser().displayName}
                badges={
                  <AuthenticatedStatus
                    label={messageTranslate(`admin.machine.statusValue.${machineUser().status}`)}
                    tone={machineUserStatusTone(machineUser().status)}
                  />
                }
                actions={
                  <AuthenticatedButton
                    icon={mdiPencil}
                    onClick={() => {
                      state.editForm.load()
                      state.editOpenSet(true)
                    }}
                    variant="outline"
                  >
                    {messageTranslate("admin.machine.users.edit")}
                  </AuthenticatedButton>
                }
                facts={[
                  {
                    label: messageTranslate("admin.machine.users.userName"),
                    value: <span class="font-mono text-xs">{machineUser().userName}</span>,
                  },
                  {
                    label: messageTranslate("admin.machine.users.identifier"),
                    value: (
                      <AuthenticatedCopyableId
                        label={messageTranslate("admin.redesign.machineUserId")}
                        value={machineUser().id}
                      />
                    ),
                  },
                  {
                    label: messageTranslate("admin.machine.created"),
                    value: <AuthenticatedRelativeTime value={machineUser().createdAt} />,
                  },
                  {
                    label: messageTranslate("admin.machine.updated"),
                    value: <AuthenticatedRelativeTime value={machineUser().updatedAt} />,
                  },
                  {
                    label: messageTranslate("admin.machine.users.scopes"),
                    value: (
                      <span class="flex flex-wrap gap-1">
                        <Show
                          when={machineUser().scopes.length > 0}
                          fallback={messageTranslate("admin.machine.users.noScopes")}
                        >
                          <For each={machineUser().scopes}>
                            {(scope) => <AuthenticatedChip class="font-mono" label={scope} />}
                          </For>
                        </Show>
                      </span>
                    ),
                  },
                ]}
              />
              <div class="flex flex-wrap items-center gap-2 rounded-lg border border-line-subtle px-4 py-2 text-xs">
                <h2 class="font-medium">{messageTranslate("admin.machine.secret.title")}</h2>
                <span class="text-muted-foreground" data-secret-redacted>
                  {messageTranslate("admin.machine.secret.redacted")}
                </span>
                <AuthenticatedButton
                  disabled={state.page.pendingId() !== undefined}
                  icon={mdiAutorenew}
                  onClick={() => void state.page.clientSecretRotate(machineUser().id)}
                  variant="outline"
                >
                  {messageTranslate("admin.machine.secret.rotate")}
                </AuthenticatedButton>
                <span class="ml-auto flex flex-wrap gap-2">
                  <Show when={machineUser().status === "active"}>
                    <AuthenticatedButton
                      disabled={state.page.pendingId() !== undefined}
                      icon={mdiCancel}
                      onClick={() => void state.page.machineUserLifecycleSet(machineUser().id, "inactive")}
                      variant="outline"
                    >
                      {messageTranslate("admin.machine.lifecycle.deactivate")}
                    </AuthenticatedButton>
                  </Show>
                  <Show when={machineUser().status === "inactive"}>
                    <AuthenticatedButton
                      disabled={state.page.pendingId() !== undefined}
                      icon={mdiCheckCircle}
                      onClick={() => void state.page.machineUserLifecycleSet(machineUser().id, "active")}
                      variant="outline"
                    >
                      {messageTranslate("admin.machine.lifecycle.activate")}
                    </AuthenticatedButton>
                  </Show>
                  <AuthenticatedButton
                    disabled={state.page.pendingId() !== undefined}
                    icon={mdiDelete}
                    onClick={() => void state.machineUserRemove(machineUser().id)}
                    variant="outlineRed"
                  >
                    {messageTranslate("admin.machine.lifecycle.remove")}
                  </AuthenticatedButton>
                </span>
              </div>

              <MachineAdminEditDialog state={state} />

              <AuthenticatedSection
                actions={
                  <AuthenticatedDialog
                    description={messageTranslate("admin.machine.credentials.issueDescription")}
                    onOpenChange={state.issueOpenSet}
                    open={state.issueOpen()}
                    title={messageTranslate("admin.machine.credentials.issue")}
                    triggerLabel={messageTranslate("admin.machine.credentials.issue")}
                    triggerIcon={mdiKeyPlus}
                    variant="filledBlue"
                  >
                    <MachineAdminCredentialForm kindSet={state.issueKindSet} state={state.credentialForm} />
                  </AuthenticatedDialog>
                }
                description={messageTranslate("admin.machine.credentials.description")}
                title={messageTranslate("admin.machine.credentials.title")}
              >
                <MachineAdminCredentialTable state={state.page} />
              </AuthenticatedSection>
            </div>
          )}
        </Show>
      </MachineAdminStateBoundary>
    </section>
  )
}

function MachineAdminEditDialog(props: { readonly state: ReturnType<typeof machineAdminDetailViewStateCreate> }) {
  const state = props.state
  return (
    <AuthenticatedDialog
      onOpenChange={state.editOpenSet}
      open={state.editOpen()}
      title={messageTranslate("admin.machine.users.editTitle")}
    >
      <form
        class="grid max-w-3xl gap-4 [&_label]:text-[0.8125rem] [&_label]:font-medium [&_div.grid]:gap-y-1.5"
        onSubmit={state.editForm.submit}
      >
        <div class="grid min-w-0 gap-1">
          <Label for="machine-user-edit-name">{messageTranslate("admin.machine.users.displayName")}</Label>
          <AuthenticatedInput
            id="machine-user-edit-name"
            onInput={(event) => state.editForm.displayName.set(event.currentTarget.value)}
            value={state.editForm.displayName.get()}
          />
        </div>
        <div class="grid min-w-0 gap-1">
          <Label for="machine-user-edit-scopes">{messageTranslate("admin.machine.users.scopes")}</Label>
          <AuthenticatedInput
            class="font-mono text-xs"
            id="machine-user-edit-scopes"
            onInput={(event) => state.editForm.scopes.set(event.currentTarget.value)}
            value={state.editForm.scopes.get()}
          />
          <p class="text-xs leading-4 text-muted-foreground">{messageTranslate("admin.machine.users.scopesHint")}</p>
        </div>

        <Show when={state.editForm.formError()}>
          {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
        </Show>

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
  )
}
