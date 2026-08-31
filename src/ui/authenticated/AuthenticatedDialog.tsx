import Dialog from "@corvu/dialog"
import { type JSX, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import type { ButtonVariant } from "#ui/interactive/button/buttonCva.js"
import { buttonCva2 } from "#ui/interactive/button/buttonCva.js"
import { classesButtonClickAnimation } from "#ui/interactive/button/classesButtonClickAnimation.js"
import { classesDialogContentMerge, classesDialogOverlayMerge } from "#ui/interactive/dialog/classesDialogContent.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import { authenticatedDialogStateCreate } from "./authenticatedDialogStateCreate.js"

/**
 * Modal dialog for authenticated pages. It matches the vendored dialog visually but only points the
 * trigger's `aria-controls` at the dialog while that element exists, because the vendored trigger
 * always references an id that is absent when the dialog is closed and assistive technology then
 * reports a dangling reference. Controlled closure also restores trigger focus explicitly, including
 * when an async success reload remounts the dialog before closing it.
 */
export function AuthenticatedDialog(props: {
  readonly children: JSX.Element
  readonly class?: string
  readonly description?: string
  readonly disabled?: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly open: boolean
  readonly title: string
  readonly triggerLabel: JSX.Element
  readonly variant?: ButtonVariant
}) {
  const state = authenticatedDialogStateCreate(() => props.open)

  return (
    <Dialog dialogId={state.dialogId} onOpenChange={props.onOpenChange} open={props.open}>
      <Dialog.Trigger
        class={buttonCva2(props.variant, undefined, classesButtonClickAnimation, props.class)}
        disabled={props.disabled}
        ref={state.triggerRegister}
      >
        {props.triggerLabel}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay class={classesDialogOverlayMerge()} />
        <Dialog.Content class={classesDialogContentMerge("w-[calc(100vw-2rem)] max-w-lg")}>
          <div class="mb-4 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <Dialog.Label class="text-base font-semibold">{props.title}</Dialog.Label>
              <Show when={props.description}>
                {(description) => (
                  <Dialog.Description class="text-sm text-muted-foreground">{description()}</Dialog.Description>
                )}
              </Show>
            </div>
            <Dialog.Close as={Button} class="h-8 text-xs" variant="outline">
              {messageTranslate("common.close")}
            </Dialog.Close>
          </div>
          {props.children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}
