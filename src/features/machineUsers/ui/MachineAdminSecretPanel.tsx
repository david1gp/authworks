import { Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { MachineAdminIssuedSecret } from "./machineAdminIssuedSecret.js"
import { machineAdminSecretPanelStateCreate } from "./machineAdminSecretPanelStateCreate.js"

/**
 * Displays a newly issued machine credential exactly once. The value is not recoverable after
 * acknowledgement, so the copy control and the warning are always shown together.
 */
export function MachineAdminSecretPanel(props: {
  readonly issued: MachineAdminIssuedSecret
  readonly onAcknowledge: () => void
}) {
  const state = machineAdminSecretPanelStateCreate({
    onAcknowledge: () => props.onAcknowledge(),
    secret: () => props.issued.secret,
  })

  const title = () => {
    if (props.issued.kind === "client_secret") return messageTranslate("admin.machine.secret.clientTitle")
    if (props.issued.kind === "api_key") return messageTranslate("admin.machine.secret.apiKeyTitle")
    return messageTranslate("admin.machine.secret.tokenTitle")
  }

  return (
    <article
      aria-live="polite"
      class="min-w-0 rounded-2xl border border-amber-400 bg-amber-50 p-5 shadow-sm"
      data-one-time-secret="machine-credential"
    >
      <h3 class="font-semibold text-amber-950">{title()}</h3>
      <p class="mt-2 text-sm text-amber-900">
        {messageTranslate("admin.machine.secret.once", { name: props.issued.machineUserName })}
      </p>
      {/* A client-credentials pair is only usable together, so the identifier is shown alongside. */}
      <Show when={props.issued.clientId}>
        {(clientId) => (
          <div class="mt-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-amber-900">
              {messageTranslate("admin.machine.secret.clientId")}
            </p>
            <code class="mt-1 block max-w-full break-all rounded-lg bg-white p-3 font-mono text-sm" data-client-id>
              {clientId()}
            </code>
          </div>
        )}
      </Show>
      <p class="mt-4 text-xs font-semibold uppercase tracking-wider text-amber-900">
        {messageTranslate("admin.machine.secret.value")}
      </p>
      {/* The secret wraps rather than widening the page, so it stays fully readable on a phone. */}
      <code class="mt-1 block max-w-full break-all rounded-lg bg-white p-3 font-mono text-sm" data-secret-value>
        {props.issued.secret}
      </code>
      <div class="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={state.copy} variant="outline">
          {messageTranslate("admin.machine.secret.copy")}
        </Button>
        {/* Acknowledgement stays reachable when the clipboard is denied, so the value is never trapped. */}
        <Button disabled={!state.copied() && !state.copyFailed()} onClick={state.acknowledge} variant="filledBlue">
          {messageTranslate("admin.machine.secret.acknowledge")}
        </Button>
        <Show when={state.copied()}>
          <span class="text-sm font-medium text-green-800" role="status">
            {messageTranslate("admin.machine.secret.copied")}
          </span>
        </Show>
        <Show when={state.copyFailed()}>
          <span class="text-sm font-medium text-danger" role="alert">
            {messageTranslate("admin.machine.secret.copyFailed")}
          </span>
        </Show>
      </div>
    </article>
  )
}
