import { mdiAutorenew } from "@adaptive-ds/mdi/mdiAutorenew.js"
import { mdiCancel } from "@adaptive-ds/mdi/mdiCancel.js"
import { mdiCheckCircle } from "@adaptive-ds/mdi/mdiCheckCircle.js"
import { mdiDelete } from "@adaptive-ds/mdi/mdiDelete.js"
import { mdiKeyPlus } from "@adaptive-ds/mdi/mdiKeyPlus.js"
import { Show } from "solid-js"
import { ButtonIcon } from "#ui/interactive/button/ButtonIcon.jsx"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
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
              <AuthenticatedSection
                actions={
                  <AuthenticatedStatus
                    label={messageTranslate(`admin.machine.statusValue.${machineUser().status}`)}
                    tone={machineUserStatusTone(machineUser().status)}
                  />
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
              <div class="grid min-w-0 gap-3 xl:grid-cols-2 [&>*]:min-w-0">
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
                    <ButtonIcon
                      disabled={state.page.pendingId() !== undefined}
                      icon={mdiAutorenew}
                      onClick={() => void state.page.clientSecretRotate(machineUser().id)}
                      variant="filledBlue"
                    >
                      {messageTranslate("admin.machine.secret.rotate")}
                    </ButtonIcon>
                  </div>
                </AuthenticatedSection>

                <AuthenticatedSection
                  description={messageTranslate("admin.machine.lifecycle.description")}
                  padded
                  title={messageTranslate("admin.machine.lifecycle.title")}
                >
                  <div class="flex flex-wrap gap-2">
                    <Show when={machineUser().status === "active"}>
                      <ButtonIcon
                        disabled={state.page.pendingId() !== undefined}
                        icon={mdiCancel}
                        onClick={() => void state.page.machineUserLifecycleSet(machineUser().id, "inactive")}
                        variant="outline"
                      >
                        {messageTranslate("admin.machine.lifecycle.deactivate")}
                      </ButtonIcon>
                    </Show>
                    <Show when={machineUser().status === "inactive"}>
                      <ButtonIcon
                        disabled={state.page.pendingId() !== undefined}
                        icon={mdiCheckCircle}
                        onClick={() => void state.page.machineUserLifecycleSet(machineUser().id, "active")}
                        variant="outline"
                      >
                        {messageTranslate("admin.machine.lifecycle.activate")}
                      </ButtonIcon>
                    </Show>
                    <ButtonIcon
                      disabled={state.page.pendingId() !== undefined}
                      icon={mdiDelete}
                      onClick={() => void state.machineUserRemove(machineUser().id)}
                      variant="filledRed"
                    >
                      {messageTranslate("admin.machine.lifecycle.remove")}
                    </ButtonIcon>
                  </div>
                </AuthenticatedSection>
              </div>

              <AuthenticatedSection
                actions={
                  <AuthenticatedDialog
                    class="h-7 text-xs"
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
