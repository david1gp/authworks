import { mdiClose } from "@adaptive-ds/mdi/mdiClose.js"
import Dialog from "@corvu/dialog"
import { type JSX, Show } from "solid-js"
import type { ButtonVariant } from "#ui/interactive/button/buttonCva.js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { classMerge } from "#ui/utils/classMerge.js"
import { confirmDialogStack } from "../confirm/confirmDialogStack.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import { AuthenticatedButton } from "./AuthenticatedButton.js"
import { authenticatedDialogClasses } from "./authenticatedDialogClasses.js"
import { authenticatedDialogStateCreate } from "./authenticatedDialogStateCreate.js"
import { authenticatedDialogTriggerClassGet } from "./authenticatedDialogTriggerClassGet.js"

/**
 * Modal dialog for authenticated pages. It uses authenticated surface tokens and only points the
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
  readonly triggerLabel?: JSX.Element
  readonly triggerIcon?: string
  readonly variant?: ButtonVariant
}) {
  const state = authenticatedDialogStateCreate(() => props.open)

  return (
    <Dialog
      dialogId={state.dialogId}
      closeOnEscapeKeyDown={!confirmDialogStack.active()}
      closeOnOutsidePointer={!confirmDialogStack.active()}
      onOpenChange={props.onOpenChange}
      open={props.open}
      restoreFocus={!confirmDialogStack.active()}
      trapFocus={!confirmDialogStack.active()}
    >
      <Show when={props.triggerLabel !== undefined}>
        <Dialog.Trigger
          class={authenticatedDialogTriggerClassGet(props.variant, props.class)}
          disabled={props.disabled}
          ref={state.triggerRegister}
        >
          <Show when={props.triggerIcon}>{(icon) => <Icon class="size-4" path={icon()} />}</Show>
          {props.triggerLabel}
        </Dialog.Trigger>
      </Show>
      <Dialog.Portal>
        <Dialog.Overlay class={classMerge(authenticatedDialogClasses.overlay, "z-40")} />
        <Dialog.Content class={classMerge(authenticatedDialogClasses.content, "z-50 w-[calc(100vw-2rem)] max-w-lg")}>
          <div class="mb-4 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <Dialog.Label class="break-all text-lg font-semibold tracking-tight">{props.title}</Dialog.Label>
              <Show when={props.description}>
                {(description) => (
                  <Dialog.Description class="text-sm text-muted-foreground">{description()}</Dialog.Description>
                )}
              </Show>
            </div>
            <Dialog.Close as={AuthenticatedButton} class="shrink-0" icon={mdiClose} size="sm" variant="outline">
              {messageTranslate("common.close")}
            </Dialog.Close>
          </div>
          {props.children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}
