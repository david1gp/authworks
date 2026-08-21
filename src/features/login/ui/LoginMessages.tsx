import { Show } from "solid-js"

/** Renders the validation and request-level messages shared by every login form. */
export function LoginMessages(props: { readonly errorMessage?: string; readonly validationMessage?: string }) {
  return (
    <>
      <Show when={props.validationMessage}>
        {(message) => (
          <p class="text-sm text-danger" role="alert">
            {message()}
          </p>
        )}
      </Show>
      <Show when={props.errorMessage}>
        {(message) => (
          <p
            class="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
            data-login-error="request"
            role="alert"
          >
            {message()}
          </p>
        )}
      </Show>
    </>
  )
}
