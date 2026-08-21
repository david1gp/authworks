import { Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { oidcAdminSecretPanelStateCreate } from "./oidcAdminSecretPanelStateCreate.js"

/**
 * Displays a newly issued client secret exactly once. The value is not recoverable after
 * acknowledgement, so the copy control and the warning are always shown together.
 */
export function OidcAdminSecretPanel(props: {
  readonly clientName: string
  readonly kind: "created" | "rotated"
  readonly onAcknowledge: () => void
  readonly secret: string
}) {
  const state = oidcAdminSecretPanelStateCreate({
    onAcknowledge: () => props.onAcknowledge(),
    secret: () => props.secret,
  })

  return (
    <article
      aria-live="polite"
      class="min-w-0 rounded-2xl border border-amber-400 bg-amber-50 p-5 shadow-sm"
      data-one-time-secret="oidc-client"
    >
      <h3 class="font-semibold text-amber-950">
        {props.kind === "created"
          ? messageTranslate("admin.oidc.secret.createdTitle")
          : messageTranslate("admin.oidc.secret.rotatedTitle")}
      </h3>
      <p class="mt-2 text-sm text-amber-900">
        {messageTranslate("admin.oidc.secret.once", { client: props.clientName })}
      </p>
      {/* The secret wraps rather than widening the page, so it stays fully readable on a phone. */}
      <code class="mt-4 block max-w-full break-all rounded-lg bg-white p-3 font-mono text-sm" data-secret-value>
        {props.secret}
      </code>
      <div class="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={state.copy} variant="outline">
          {messageTranslate("admin.oidc.secret.copy")}
        </Button>
        {/* Acknowledgement stays reachable when the clipboard is denied, so the value is never trapped. */}
        <Button disabled={!state.copied() && !state.copyFailed()} onClick={state.acknowledge} variant="filledBlue">
          {messageTranslate("admin.oidc.secret.acknowledge")}
        </Button>
        <Show when={state.copied()}>
          <span class="text-sm font-medium text-green-800" role="status">
            {messageTranslate("admin.oidc.secret.copied")}
          </span>
        </Show>
        <Show when={state.copyFailed()}>
          <span class="text-sm font-medium text-danger" role="alert">
            {messageTranslate("admin.oidc.secret.copyFailed")}
          </span>
        </Show>
      </div>
    </article>
  )
}
