import { createEffect, createUniqueId, on, onCleanup, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import type { MessageKey } from "../i18n/model/messageKeySchema.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import { confirmDialogFocusNextSelect } from "./confirmDialogFocusNextSelect.js"
import type { ConfirmState } from "./confirmStateCreate.js"

const focusableSelector =
  "button:not([disabled]),[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex='-1'])"

/**
 * The localized, cancelable confirmation shown before a destructive action. It is a modal
 * alert dialog so every feature shows the same prompt in production and in the stateless
 * demo instead of a native prompt or a silent auto-accept. The title key stays feature-owned.
 */
export function ConfirmDialog(props: { readonly state: ConfirmState; readonly titleKey: MessageKey }) {
  const state = props.state
  const id = createUniqueId()
  let container: HTMLDivElement | undefined
  let cancel: HTMLButtonElement | undefined
  let trigger: HTMLElement | undefined

  const focusable = () => [...(container?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])]

  // Unmounting the dialog settles any open promise, so no caller waits on a gone screen.
  onCleanup(() => state.dispose())

  // Focus moves into the prompt when it opens and returns to the control that opened it,
  // so a keyboard operator never loses their place and cannot reach the page behind.
  createEffect(
    on(state.open, (open) => {
      if (open) {
        const active = document.activeElement
        trigger = active instanceof HTMLElement ? active : undefined
        cancel?.focus()
        return
      }
      // A trigger that was removed with its screen cannot take focus back.
      if (trigger?.isConnected === true) trigger.focus()
      trigger = undefined
    }),
  )

  return (
    <Show when={state.open()}>
      {/* Clicking the backdrop cancels, matching Escape. */}
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* A real button backdrop cancels on click; Escape is its keyboard equivalent, and it
            stays out of the tab order because focus is trapped inside the dialog. */}
        <button
          aria-label={messageTranslate("common.cancel")}
          class="absolute inset-0 cursor-default bg-black/50"
          data-confirm-backdrop
          onClick={state.cancel}
          tabIndex={-1}
          type="button"
        />
        {/* Escape cancels, and cancel is focused first so the destructive choice is never the default. */}
        <div
          aria-describedby={`${id}-message`}
          aria-labelledby={`${id}-title`}
          aria-modal="true"
          class="relative w-full max-w-md rounded-lg border border-line bg-surface p-6 shadow-lg"
          data-confirm-dialog
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              state.cancel()
              return
            }
            if (event.key !== "Tab") return
            const active = document.activeElement
            const next = confirmDialogFocusNextSelect({
              active: active instanceof HTMLElement ? active : undefined,
              backwards: event.shiftKey,
              elements: focusable(),
            })
            if (next === undefined) return
            event.preventDefault()
            next.focus()
          }}
          ref={container}
          role="alertdialog"
          tabIndex={-1}
        >
          <h2 class="text-lg font-semibold" id={`${id}-title`}>
            {messageTranslate(props.titleKey)}
          </h2>
          <p class="mt-2 break-words text-sm text-muted-foreground" id={`${id}-message`}>
            {state.message()}
          </p>
          <div class="mt-6 flex flex-wrap justify-end gap-2">
            <Button autofocus data-confirm-cancel onClick={state.cancel} ref={cancel} variant="outline">
              {messageTranslate("common.cancel")}
            </Button>
            <Button data-confirm-accept onClick={state.accept} variant="filledRed">
              {messageTranslate("common.continue")}
            </Button>
          </div>
        </div>
      </div>
    </Show>
  )
}
