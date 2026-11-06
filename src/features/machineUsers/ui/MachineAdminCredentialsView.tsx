import { A } from "@solidjs/router"
import { Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedSelect } from "../../../ui/authenticated/AuthenticatedSelect.js"
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
      <AuthenticatedPageHeader
        title={messageTranslate("admin.machine.credentials.title")}
        description={`${state.page.credentials().length} credentials`}
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
      />
      <AuthenticatedToolbar label={messageTranslate("admin.machine.credentials.title")}>
        <Label class="sr-only" for="machine-credential-subject">
          {messageTranslate("admin.machine.credentials.subject")}
        </Label>
        <div class="w-full sm:max-w-xs">
          <AuthenticatedSelect
            getOptions={() => state.page.machineUsers().map((machineUser) => machineUser.id)}
            id="machine-credential-subject"
            valueSignal={state.machineUserIdSignal}
            valueText={(machineUserId) => state.page.machineUserName(machineUserId)}
          />
        </div>
      </AuthenticatedToolbar>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <Show when={state.activeMachineUserId() !== ""}>
          <A class="font-medium text-accent hover:underline" href={state.machineUserDetailHref()}>
            {state.page.machineUserName(state.activeMachineUserId())}
          </A>
        </Show>
        <A class="font-medium text-accent hover:underline" href={state.serviceAccountsHref()}>
          {messageTranslate("admin.users.directoryTabServiceAccounts")}
        </A>
      </div>

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
