import { Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { SelectSingleNative } from "#ui/input/select/SelectSingleNative.jsx"
import { CorvuDialog } from "#ui/interactive/dialog/CorvuDialog.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
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
    <section class="grid min-w-0 gap-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 class="text-2xl font-semibold tracking-tight">{messageTranslate("admin.machine.credentials.title")}</h2>
          <p class="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {messageTranslate("admin.machine.credentials.description")}
          </p>
        </div>
        <CorvuDialog
          buttonChildren={messageTranslate("admin.machine.credentials.issue")}
          description={messageTranslate("admin.machine.credentials.issueDescription")}
          onOpenChange={state.issueOpenSet}
          open={state.issueOpen()}
          title={messageTranslate("admin.machine.credentials.issue")}
          variant="filledBlue"
        >
          <MachineAdminCredentialForm kindSet={state.issueKindSet} state={state.credentialForm} />
        </CorvuDialog>
      </div>

      <MachineAdminNotice notice={state.page.notice()} />
      <Show when={state.page.issuedSecret()}>
        {(issued) => <MachineAdminSecretPanel issued={issued()} onAcknowledge={state.page.issuedSecretAcknowledge} />}
      </Show>

      <CardWrapper class="min-w-0">
        <div class="grid max-w-sm gap-2">
          <Label for="machine-credential-subject">{messageTranslate("admin.machine.credentials.subject")}</Label>
          <SelectSingleNative
            getOptions={() => state.page.machineUsers().map((machineUser) => machineUser.id)}
            id="machine-credential-subject"
            valueSignal={state.machineUserIdSignal}
            valueText={(machineUserId) => state.page.machineUserName(machineUserId)}
          />
        </div>
      </CardWrapper>

      <MachineAdminStateBoundary
        emptyDetail={messageTranslate("admin.machine.credentials.empty")}
        error={state.page.error()}
        onRetry={state.page.reload}
        status={state.page.status()}
      >
        <CardWrapper class="min-w-0">
          <MachineAdminCredentialTable state={state.page} />
        </CardWrapper>
      </MachineAdminStateBoundary>
    </section>
  )
}
