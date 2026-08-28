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
      class="grid min-w-0 gap-2 rounded-panel border border-warning/45 bg-warning-soft px-3 py-2.5"
      data-one-time-secret="machine-credential"
    >
      <div class="grid min-w-0 gap-0.5">
        <h2 class="text-sm font-semibold tracking-tight">{title()}</h2>
        {/* Muted grey fails contrast on the warning tint, so panel prose uses the warning token. */}
        <p class="text-xs text-warning">
          {messageTranslate("admin.machine.secret.once", { name: props.issued.machineUserName })}
        </p>
      </div>

      {/* A client-credentials pair is only usable together, so the identifier is shown alongside. */}
      <Show when={props.issued.clientId}>
        {(clientId) => (
          <div class="grid min-w-0 gap-1">
            <p class="text-2xs font-semibold tracking-[0.12em] uppercase text-warning">
              {messageTranslate("admin.machine.secret.clientId")}
            </p>
            <code
              class="block max-w-full break-all rounded-control border border-line bg-surface px-2 py-1.5 font-mono text-xs leading-5"
              data-client-id
            >
              {clientId()}
            </code>
          </div>
        )}
      </Show>

      <div class="grid min-w-0 gap-1">
        <p class="text-2xs font-semibold tracking-[0.12em] uppercase text-warning">
          {messageTranslate("admin.machine.secret.value")}
        </p>
        {/* The secret wraps rather than widening the page, so it stays fully readable on a phone. */}
        <code
          class="block max-w-full break-all rounded-control border border-line bg-surface px-2 py-1.5 font-mono text-xs leading-5"
          data-secret-value
        >
          {props.issued.secret}
        </code>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Button onClick={state.copy} size="sm" variant="outline">
          {messageTranslate("admin.machine.secret.copy")}
        </Button>
        {/* Acknowledgement stays reachable when the clipboard is denied, so the value is never trapped. */}
        <Button
          disabled={!state.copied() && !state.copyFailed()}
          onClick={state.acknowledge}
          size="sm"
          variant="filledBlue"
        >
          {messageTranslate("admin.machine.secret.acknowledge")}
        </Button>
        <Show when={state.copied()}>
          <span class="text-xs font-medium text-success" role="status">
            {messageTranslate("admin.machine.secret.copied")}
          </span>
        </Show>
        <Show when={state.copyFailed()}>
          <span class="text-xs font-medium text-danger" role="alert">
            {messageTranslate("admin.machine.secret.copyFailed")}
          </span>
        </Show>
      </div>
    </article>
  )
}
