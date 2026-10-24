import { mdiClose } from "@adaptive-ds/mdi/mdiClose.js"
import Dialog from "@corvu/dialog"
import { type JSX, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import type { ButtonVariant } from "#ui/interactive/button/buttonCva.js"
import { classMerge } from "#ui/utils/classMerge.js"
import { confirmDialogStack } from "../confirm/confirmDialogStack.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import { AuthenticatedButton } from "./AuthenticatedButton.js"
import { authenticatedDialogClasses } from "./authenticatedDialogClasses.js"
import { authenticatedDialogStateCreate } from "./authenticatedDialogStateCreate.js"
import { authenticatedDialogTriggerClassGet } from "./authenticatedDialogTriggerClassGet.js"

/**
 * Clones the caller-rendered trigger element with the corvu dialog trigger behavior merged in,
 * so the dialog exposes a single real button carrying the caller's accessible name instead of
 * nesting one button inside another.
 */
function DialogTriggerClone(props: {
  readonly disabled?: boolean
  readonly trigger: JSX.Element
  readonly triggerClass: string
  readonly triggerRegister: (element: HTMLButtonElement) => void
}) {
  return (
    <Dialog.Trigger
      as={(...outerArguments: readonly unknown[]) => {
        const triggerProperties = outerArguments[0] as Record<string, unknown> | undefined
        const rawTrigger = typeof props.trigger === "function" ? (props.trigger as () => JSX.Element)() : props.trigger
        const element = (typeof rawTrigger === "function"
          ? (rawTrigger as () => JSX.Element)()
          : rawTrigger) as unknown as {
          readonly type?: unknown
          readonly props?: Record<string, unknown>
        }
        if (element === undefined || element === null || typeof element !== "object") return null
        if ((element as { type?: unknown }).type === undefined) return null
        return (
          <Dynamic
            component={element.type as string}
            {...(element.props ?? {})}
            {...triggerProperties}
            class={props.triggerClass}
          />
        )
      }}
    />
  )
}

/**
 * Modal dialog for authenticated pages. It uses authenticated surface tokens and only points the
 * trigger's `aria-controls` at the dialog while that element exists, because the vendored trigger
 * always references an id that is absent when the dialog is closed and assistive technology then
 * reports a dangling reference. Controlled closure also restores trigger focus explicitly,
 * including when an async success reload remounts the dialog before closing it.
 *
 * The optional `trigger` replaces the default text trigger button with a caller-rendered element
 * (usually an `AuthenticatedButton` with a visible label). The corvu trigger shell renders that
 * element as its content; a leading hidden marker keeps the multi-child normalization intact so
 * the caller's labeled element is preserved as the trigger's accessible name. Dialogs opened
 * from a row action instead of their own trigger render without any trigger element.
 */
export function AuthenticatedDialog(props: {
  readonly children: JSX.Element
  readonly class?: string
  readonly description?: string
  readonly disabled?: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly open: boolean
  readonly title: string
  readonly trigger?: JSX.Element
  readonly triggerSize?: "sm" | "md"
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
      <DialogTriggerClone
        trigger={props.trigger as JSX.Element}
        triggerClass={authenticatedDialogTriggerClassGet(props.variant, props.class, props.triggerSize)}
        disabled={props.disabled}
        triggerRegister={state.triggerRegister}
      />
      <Dialog.Portal>
        <Dialog.Overlay class={classMerge(authenticatedDialogClasses.overlay, "z-40")} />
        <Dialog.Content class={classMerge(authenticatedDialogClasses.content, "z-50 w-[calc(100vw-2rem)] max-w-lg")}>
          <div class="mb-4 flex items-start justify-between gap-2">
            <div class="min-w-0">
              <Dialog.Label class="break-words text-lg font-semibold tracking-tight">{props.title}</Dialog.Label>
              <Show when={props.description}>
                {(description) => (
                  <Dialog.Description class="text-sm text-muted-foreground">{description()}</Dialog.Description>
                )}
              </Show>
            </div>
            <Dialog.Close
              as={AuthenticatedButton}
              title={messageTranslate("common.close")}
              class="-mt-0.5 shrink-0"
              icon={mdiClose}
              size="sm"
              variant="ghost"
            />
          </div>
          {props.children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}
