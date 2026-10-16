import { mdiCheck } from "@adaptive-ds/mdi/mdiCheck.js"
import { mdiClose } from "@adaptive-ds/mdi/mdiClose.js"
import Dialog from "@corvu/dialog"
import { createEffect, onCleanup } from "solid-js"
import { classMerge } from "#ui/utils/classMerge.js"
import { AuthenticatedButton } from "../authenticated/AuthenticatedButton.js"
import { authenticatedDialogClasses } from "../authenticated/authenticatedDialogClasses.js"
import type { MessageKey } from "../i18n/model/messageKeySchema.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import { confirmDialogStack } from "./confirmDialogStack.js"
import type { ConfirmState } from "./confirmStateCreate.js"

/**
 * The localized, cancelable confirmation shown before a destructive action. It is a modal
 * alert dialog so every feature shows the same prompt in production and in the stateless
 * demo instead of a native prompt or a silent auto-accept. The title key stays feature-owned.
 */
export function ConfirmDialog(props: { readonly state: ConfirmState; readonly titleKey: MessageKey }) {
  const state = props.state

  // Unmounting the dialog settles any open promise, so no caller waits on a gone screen.
  onCleanup(() => state.dispose())
  createEffect(() => {
    if (state.open()) onCleanup(confirmDialogStack.enter())
  })

  return (
    <Dialog onOpenChange={(open) => !open && state.cancel()} open={state.open()} role="alertdialog">
      <Dialog.Portal>
        <Dialog.Overlay class={classMerge(authenticatedDialogClasses.overlay, "z-[60]")} data-confirm-backdrop />
        <Dialog.Content
          class={classMerge(authenticatedDialogClasses.content, "z-[70] w-[calc(100vw-2rem)] max-w-md")}
          data-confirm-dialog
        >
          <Dialog.Label class="text-lg font-semibold tracking-tight">
            {state.title() ?? messageTranslate(props.titleKey)}
          </Dialog.Label>
          <Dialog.Description class="mt-1 break-words text-sm text-muted-foreground">
            {state.message()}
          </Dialog.Description>
          <div class="mt-5 flex flex-wrap justify-end gap-2">
            <AuthenticatedButton data-confirm-cancel icon={mdiClose} onClick={state.cancel} variant="outline">
              {messageTranslate("common.cancel")}
            </AuthenticatedButton>
            <AuthenticatedButton data-confirm-accept icon={mdiCheck} onClick={state.accept} variant="filledRed">
              {state.acceptLabel() ?? messageTranslate("common.continue")}
            </AuthenticatedButton>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}
