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
      class="grid min-w-0 gap-2 rounded-panel border border-warning/45 bg-warning-soft px-3 py-2.5"
      data-one-time-secret="oidc-client"
    >
      <div class="grid min-w-0 gap-0.5">
        <h2 class="text-sm font-semibold tracking-tight">
          {props.kind === "created"
            ? messageTranslate("admin.oidc.secret.createdTitle")
            : messageTranslate("admin.oidc.secret.rotatedTitle")}
        </h2>
        <p class="text-xs text-muted-foreground">
          {messageTranslate("admin.oidc.secret.once", { client: props.clientName })}
        </p>
      </div>
      {/* The secret wraps rather than widening the page, so it stays fully readable on a phone. */}
      <code
        class="block max-w-full break-all rounded-control border border-line bg-surface px-2 py-1.5 font-mono text-xs leading-5"
        data-secret-value
      >
        {props.secret}
      </code>
      <div class="flex flex-wrap items-center gap-2">
        <Button onClick={state.copy} size="sm" variant="outline">
          {messageTranslate("admin.oidc.secret.copy")}
        </Button>
        {/* Acknowledgement stays reachable when the clipboard is denied, so the value is never trapped. */}
        <Button
          disabled={!state.copied() && !state.copyFailed()}
          onClick={state.acknowledge}
          size="sm"
          variant="filledBlue"
        >
          {messageTranslate("admin.oidc.secret.acknowledge")}
        </Button>
        <Show when={state.copied()}>
          <span class="text-xs font-medium text-success" role="status">
            {messageTranslate("admin.oidc.secret.copied")}
          </span>
        </Show>
        <Show when={state.copyFailed()}>
          <span class="text-xs font-medium text-danger" role="alert">
            {messageTranslate("admin.oidc.secret.copyFailed")}
          </span>
        </Show>
      </div>
    </article>
  )
}
