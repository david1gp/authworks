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
        class={`!size-6 !p-0 rounded-control grid place-items-center shrink-0 focus-visible:ring-2 focus-visible:ring-accent transition-opacity ${
          state.feedback() === "copied"
            ? "text-success opacity-100"
            : "text-accent hover:bg-surface-hover hover:text-accent-hover opacity-60 hover:opacity-100 focus-visible:opacity-100"
        }`}
        icon={state.feedback() === "copied" ? mdiCheck : mdiContentCopy}
        iconClass="size-3.5 fill-current"
        onClick={state.copy}
        title={messageTranslate("account.profile.copy", { field: props.label })}
        type="button"
        variant="none"
      />
      <span
        aria-live="polite"
        class={
          state.feedback() === "failed"
            ? "text-xs text-danger"
            : state.feedback() === "copied"
              ? "text-xs text-success"
              : "sr-only"
        }
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
