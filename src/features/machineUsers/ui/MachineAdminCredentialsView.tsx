import { Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { SelectSingleNative } from "#ui/input/select/SelectSingleNative.jsx"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedToolbar } from "../../../ui/authenticated/AuthenticatedToolbar.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { MachineAdminCredentialForm } from "./MachineAdminCredentialForm.js"
import { MachineAdminCredentialTable } from "./MachineAdminCredentialTable.js"
import { MachineAdminNotice } from "./MachineAdminNotice.js"
import { MachineAdminSecretPanel } from "./MachineAdminSecretPanel.js"
import { MachineAdminStateBoundary } from "./MachineAdminStateBoundary.js"
import type { machineAdminCredentialsViewStateCreate } from "./machineAdminCredentialsViewStateCreate.js"

/** The realm-wide credential overview, scoped to one machine user at a time. */
export function MachineAdminCredentialsView(props: {
  readonly state: ReturnType<typeof machineAdminCredentialsViewStateCreate>
}) {
  const state = props.state
  return (
    <section aria-label={messageTranslate("admin.machine.credentials.title")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
      {/* The subject selector is the page filter, so it shares the toolbar row with the issue action. */}
      <AuthenticatedToolbar
        actions={
          <AuthenticatedDialog
            description={messageTranslate("admin.machine.credentials.issueDescription")}
            onOpenChange={state.issueOpenSet}
            open={state.issueOpen()}
            title={messageTranslate("admin.machine.credentials.issue")}
            triggerLabel={messageTranslate("admin.machine.credentials.issue")}
            variant="filledBlue"
          >
            <MachineAdminCredentialForm kindSet={state.issueKindSet} state={state.credentialForm} />
          </AuthenticatedDialog>
        }
        label={messageTranslate("admin.machine.credentials.title")}
        summary={messageTranslate("admin.machine.credentials.description")}
      >
        <Label class="sr-only" for="machine-credential-subject">
          {messageTranslate("admin.machine.credentials.subject")}
        </Label>
        <SelectSingleNative
          class="max-w-xs"
          getOptions={() => state.page.machineUsers().map((machineUser) => machineUser.id)}
          id="machine-credential-subject"
          valueSignal={state.machineUserIdSignal}
          valueText={(machineUserId) => state.page.machineUserName(machineUserId)}
        />
      </AuthenticatedToolbar>

      <MachineAdminNotice notice={state.page.notice()} />
      <Show when={state.page.issuedSecret()}>
        {(issued) => <MachineAdminSecretPanel issued={issued()} onAcknowledge={state.page.issuedSecretAcknowledge} />}
      </Show>

      <MachineAdminStateBoundary
        emptyDetail={messageTranslate("admin.machine.credentials.empty")}
        error={state.page.error()}
        onRetry={state.page.reload}
        status={state.page.status()}
      >
        <AuthenticatedSection>
          <MachineAdminCredentialTable state={state.page} />
        </AuthenticatedSection>
      </MachineAdminStateBoundary>
    </section>
  )
}
