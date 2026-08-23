import { Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { CorvuDialog } from "#ui/interactive/dialog/CorvuDialog.jsx"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { MachineAdminCredentialForm } from "./MachineAdminCredentialForm.js"
import { MachineAdminCredentialTable } from "./MachineAdminCredentialTable.js"
import { MachineAdminNotice } from "./MachineAdminNotice.js"
import { MachineAdminSecretPanel } from "./MachineAdminSecretPanel.js"
import { MachineAdminStateBoundary } from "./MachineAdminStateBoundary.js"
import { machineUserStatusBadgeVariant } from "./machineUserStatusBadgeVariant.js"
import type { machineAdminDetailViewStateCreate } from "./machineAdminDetailViewStateCreate.js"

export function MachineAdminDetailView(props: {
  readonly state: ReturnType<typeof machineAdminDetailViewStateCreate>
}) {
  const state = props.state
  return (
    <section class="grid min-w-0 gap-6">
      {/* The page heading stays outside the data boundary, so every fixture state has one h1. */}
      <h1 class="text-2xl font-semibold tracking-tight">{messageTranslate("admin.machine.users.detailTitle")}</h1>
      <MachineAdminStateBoundary
        emptyDetail={messageTranslate("admin.machine.users.empty")}
        error={state.page.error()}
        onRetry={state.page.reload}
        status={state.page.status()}
      >
        <Show when={state.page.machineUser()}>
          {(machineUser) => (
            <section class="grid min-w-0 gap-6">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 class="break-words text-2xl font-semibold tracking-tight">{machineUser().displayName}</h2>
                  <p class="mt-1 font-mono text-xs text-muted-foreground">{machineUser().userName}</p>
                </div>
                <Badge variant={machineUserStatusBadgeVariant(machineUser().status)}>{machineUser().status}</Badge>
              </div>

              <MachineAdminNotice notice={state.page.notice()} />
              <Show when={state.page.issuedSecret()}>
                {(issued) => (
                  <MachineAdminSecretPanel issued={issued()} onAcknowledge={state.page.issuedSecretAcknowledge} />
                )}
              </Show>

              <CardWrapper>
                <dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <DetailItem
                    label={messageTranslate("admin.machine.users.scopes")}
                    value={
                      machineUser().scopes.length === 0
                        ? messageTranslate("admin.machine.users.noScopes")
                        : machineUser().scopes.join(", ")
                    }
                  />
                  <DetailItem
                    label={messageTranslate("admin.machine.created")}
                    value={localeDateFormat(machineUser().createdAt, { dateStyle: "medium", timeStyle: "short" })}
                  />
                  <DetailItem
                    label={messageTranslate("admin.machine.updated")}
                    value={localeDateFormat(machineUser().updatedAt, { dateStyle: "medium", timeStyle: "short" })}
                  />
                  <DetailItem label={messageTranslate("admin.machine.status")} value={machineUser().status} />
                </dl>
              </CardWrapper>

              <CardWrapper>
                <h3 class="text-xl font-semibold">{messageTranslate("admin.machine.secret.title")}</h3>
                <p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {messageTranslate("admin.machine.secret.description")}
                </p>
                {/* The stored secret is write-only: it is only ever presented as redacted. */}
                <p
                  class="mt-3 rounded-lg bg-muted px-3 py-2 font-mono text-sm text-muted-foreground"
                  data-secret-redacted
                >
                  {messageTranslate("admin.machine.secret.redacted")}
                </p>
                <div class="mt-5 flex flex-wrap gap-2">
                  <Button
                    disabled={state.page.pendingId() !== undefined}
                    onClick={() => void state.page.clientSecretRotate(machineUser().id)}
                    variant="filledBlue"
                  >
                    {messageTranslate("admin.machine.secret.rotate")}
                  </Button>
                </div>
              </CardWrapper>

              <CardWrapper class="min-w-0">
                <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 class="text-xl font-semibold">{messageTranslate("admin.machine.credentials.title")}</h3>
                    <p class="mt-1 max-w-2xl text-sm text-muted-foreground">
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
                <MachineAdminCredentialTable state={state.page} />
              </CardWrapper>

              <CardWrapper>
                <h3 class="text-xl font-semibold">{messageTranslate("admin.machine.lifecycle.title")}</h3>
                <p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {messageTranslate("admin.machine.lifecycle.description")}
                </p>
                <div class="mt-5 flex flex-wrap gap-2">
                  <Show when={machineUser().status === "active"}>
                    <Button
                      disabled={state.page.pendingId() !== undefined}
                      onClick={() => void state.page.machineUserLifecycleSet(machineUser().id, "inactive")}
                      variant="outline"
                    >
                      {messageTranslate("admin.machine.lifecycle.deactivate")}
                    </Button>
                  </Show>
                  <Show when={machineUser().status === "inactive"}>
                    <Button
                      disabled={state.page.pendingId() !== undefined}
                      onClick={() => void state.page.machineUserLifecycleSet(machineUser().id, "active")}
                      variant="outline"
                    >
                      {messageTranslate("admin.machine.lifecycle.activate")}
                    </Button>
                  </Show>
                  <Button
                    disabled={state.page.pendingId() !== undefined}
                    onClick={() => void state.machineUserRemove(machineUser().id)}
                    variant="filledRed"
                  >
                    {messageTranslate("admin.machine.lifecycle.remove")}
                  </Button>
                </div>
              </CardWrapper>
            </section>
          )}
        </Show>
      </MachineAdminStateBoundary>
    </section>
  )
}

function DetailItem(props: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt class="text-sm text-muted-foreground">{props.label}</dt>
      <dd class="mt-1 break-all text-sm">{props.value}</dd>
    </div>
  )
}
