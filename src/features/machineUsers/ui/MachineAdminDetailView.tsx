import { mdiAutorenew } from "@adaptive-ds/mdi/mdiAutorenew.js"
import { mdiCancel } from "@adaptive-ds/mdi/mdiCancel.js"
import { mdiCheckCircle } from "@adaptive-ds/mdi/mdiCheckCircle.js"
import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiDelete } from "@adaptive-ds/mdi/mdiDelete.js"
import { mdiKeyPlus } from "@adaptive-ds/mdi/mdiKeyPlus.js"
import { mdiPencil } from "@adaptive-ds/mdi/mdiPencil.js"
import { Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { MachineAdminCredentialForm } from "./MachineAdminCredentialForm.js"
import { MachineAdminCredentialTable } from "./MachineAdminCredentialTable.js"
import { MachineAdminNotice } from "./MachineAdminNotice.js"
import { MachineAdminScopeList } from "./MachineAdminScopeList.js"
import { MachineAdminSecretPanel } from "./MachineAdminSecretPanel.js"
import { MachineAdminStateBoundary } from "./MachineAdminStateBoundary.js"
import type { machineAdminDetailViewStateCreate } from "./machineAdminDetailViewStateCreate.js"
import { machineUserStatusTone } from "./machineUserStatusTone.js"

export function MachineAdminDetailView(props: {
  readonly state: ReturnType<typeof machineAdminDetailViewStateCreate>
}) {
  const state = props.state
  return (
    <section aria-label={messageTranslate("admin.machine.users.detailTitle")} class="grid min-w-0 gap-5 [&>*]:min-w-0">
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
            <div class="grid min-w-0 gap-5 [&>*]:min-w-0">
              <AuthenticatedSection
                actions={
                  <div class="flex flex-wrap items-center gap-2">
                    <AuthenticatedStatus
                      label={messageTranslate(`admin.machine.statusValue.${machineUser().status}`)}
                      tone={machineUserStatusTone(machineUser().status)}
                    />
                    <AuthenticatedButton
                      icon={mdiPencil}
                      onClick={() => {
                        state.editForm.load()
                        state.editOpenSet(true)
                      }}
                      size="sm"
                      variant="outline"
                    >
                      {messageTranslate("admin.machine.users.edit")}
                    </AuthenticatedButton>
                  </div>
                }
                padded
                title={machineUser().displayName}
              >
                <AuthenticatedFieldList
                  columns={3}
                  fields={[
                    {
                      identifier: true,
                      label: messageTranslate("admin.machine.users.userName"),
                      value: machineUser().userName,
                    },
                    {
                      identifier: true,
                      label: messageTranslate("admin.machine.users.identifier"),
                      value: machineUser().id,
                    },
                    {
                      label: messageTranslate("admin.machine.created"),
                      value: localeDateFormat(machineUser().createdAt, { dateStyle: "medium", timeStyle: "short" }),
                    },
                    {
                      label: messageTranslate("admin.machine.updated"),
                      value: localeDateFormat(machineUser().updatedAt, { dateStyle: "medium", timeStyle: "short" }),
                    },
                    {
                      label: messageTranslate("admin.machine.users.scopes"),
                      value: (
                        <MachineAdminScopeList
                          empty={messageTranslate("admin.machine.users.noScopes")}
                          scopes={machineUser().scopes}
                        />
                      ),
                      wide: true,
                    },
                  ]}
                />
              </AuthenticatedSection>

              {/* The write-only secret and the lifecycle share a row: both are short, guarded controls. */}
              <div class="grid min-w-0 gap-5 xl:grid-cols-2 [&>*]:min-w-0">
                <AuthenticatedSection
                  description={messageTranslate("admin.machine.secret.description")}
                  padded
                  title={messageTranslate("admin.machine.secret.title")}
                >
                  {/* The stored secret is write-only: it is only ever presented as redacted. */}
                  <p
                    class="min-w-0 truncate rounded-control border border-line-subtle bg-muted px-2 py-1.5 font-mono text-xs text-muted-foreground"
                    data-secret-redacted
                  >
                    {messageTranslate("admin.machine.secret.redacted")}
                  </p>
                  <div class="mt-2 flex flex-wrap gap-2">
                    <AuthenticatedButton
                      size="sm"
                      disabled={state.page.pendingId() !== undefined}
                      icon={mdiAutorenew}
                      onClick={() => void state.page.clientSecretRotate(machineUser().id)}
                      variant="filledBlue"
                    >
                      {messageTranslate("admin.machine.secret.rotate")}
                    </AuthenticatedButton>
                  </div>
                </AuthenticatedSection>

                <AuthenticatedSection
                  description={messageTranslate("admin.machine.lifecycle.description")}
                  padded
                  title={messageTranslate("admin.machine.lifecycle.title")}
                >
                  <div class="flex flex-wrap gap-2">
                    <Show when={machineUser().status === "active"}>
                      <AuthenticatedButton
                        size="sm"
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
                        size="sm"
                        disabled={state.page.pendingId() !== undefined}
                        icon={mdiCheckCircle}
                        onClick={() => void state.page.machineUserLifecycleSet(machineUser().id, "active")}
                        variant="outline"
                      >
                        {messageTranslate("admin.machine.lifecycle.activate")}
                      </AuthenticatedButton>
                    </Show>
                    <AuthenticatedButton
                      size="sm"
                      disabled={state.page.pendingId() !== undefined}
                      icon={mdiDelete}
                      onClick={() => void state.machineUserRemove(machineUser().id)}
                      variant="outlineRed"
                    >
                      {messageTranslate("admin.machine.lifecycle.remove")}
                    </AuthenticatedButton>
                  </div>
                </AuthenticatedSection>
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
