import { createSignalObject } from "#ui/utils/createSignalObject.js"

/**
 * A destructive action may name itself, so the prompt can read "Remove this project" / "Remove
 * project" instead of the generic fallback title and "Continue".
 */
export type ConfirmRequest = {
  readonly acceptLabel?: string
  readonly message: string
  readonly title?: string
}

type PendingConfirmation = ConfirmRequest & { readonly settle: (confirmed: boolean) => void }

/**
 * The single in-app confirmation state shared by every feature that guards a destructive
 * action. It replaces native `window.confirm` and silent auto-accept, so the prompt is
 * translated, cancelable, and identical in production and in the stateless demo.
 */
export function confirmStateCreate() {
  const pending = createSignalObject<PendingConfirmation | undefined>(undefined)

  const settle = (confirmed: boolean) => {
    const current = pending.get()
    if (current === undefined) return
    pending.set(undefined)
    current.settle(confirmed)
  }

  return {
    accept: () => settle(true),
    cancel: () => settle(false),
    acceptLabel: () => pending.get()?.acceptLabel,
    confirm: (request: ConfirmRequest | string) =>
      new Promise<boolean>((resolve) => {
        // A superseded request is declined, so no caller is ever left waiting.
        settle(false)
        pending.set({ ...(typeof request === "string" ? { message: request } : request), settle: resolve })
      }),
    /**
     * Declines an open prompt because the dialog rendering it went away. A screen that
     * disappears mid-decision must never leave its caller waiting forever.
     */
    dispose: () => settle(false),
    message: () => pending.get()?.message,
    open: () => pending.get() !== undefined,
    title: () => pending.get()?.title,
  }
}

export type ConfirmState = ReturnType<typeof confirmStateCreate>
