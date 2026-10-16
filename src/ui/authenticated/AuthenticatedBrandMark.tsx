import { classMerge } from "#ui/utils/classMerge.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"

export function AuthenticatedBrandMark(props: { readonly class?: string }) {
  return (
    <span
      aria-hidden="true"
      class={classMerge(
        "grid size-8 shrink-0 place-items-center rounded-[10px] bg-accent text-base leading-none font-bold text-accent-contrast",
        props.class,
      )}
    >
      {messageTranslate("app.name").slice(0, 1)}
    </span>
  )
}
