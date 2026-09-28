import { mdiCheck } from "@adaptive-ds/mdi/mdiCheck.js"
import { mdiContentCopy } from "@adaptive-ds/mdi/mdiContentCopy.js"
import { ButtonIconOnly } from "#ui/interactive/button/ButtonIconOnly.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { accountIdentityCopyStateCreate } from "./accountIdentityCopyStateCreate.js"

export function AccountIdentityCopyButton(props: { readonly label: string; readonly value: string }) {
  const state = accountIdentityCopyStateCreate({ value: () => props.value })
  return (
    <>
      <ButtonIconOnly
        aria-label={messageTranslate("account.profile.copy", { field: props.label })}
        class="!size-7 shrink-0 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
        icon={state.feedback() === "copied" ? mdiCheck : mdiContentCopy}
        onClick={state.copy}
        title={messageTranslate("account.profile.copy", { field: props.label })}
        type="button"
        variant="ghost"
      />
      <span
        aria-live="polite"
        class={state.feedback() === "failed" ? "text-xs text-danger" : "text-xs text-success"}
        role="status"
      >
        {state.feedback() === "copied"
          ? messageTranslate("account.profile.copied", { field: props.label })
          : state.feedback() === "failed"
            ? messageTranslate("account.profile.copyFailed", { field: props.label })
            : ""}
      </span>
    </>
  )
}
