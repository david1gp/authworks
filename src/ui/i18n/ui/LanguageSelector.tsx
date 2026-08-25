import { mdiTranslateVariant } from "@adaptive-ds/mdi/mdiTranslateVariant.js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { messageTranslate } from "../model/messageTranslate.js"
import { languageSelectorStateCreate } from "./languageSelectorStateCreate.js"

type LanguageSelectorProps = {
  readonly class?: string
}

/** Compact, accessible locale selector shared by authenticated and demo layouts. */
export function LanguageSelector(props: LanguageSelectorProps) {
  const state = languageSelectorStateCreate()
  return (
    <label class={`inline-flex items-center gap-2 ${props.class ?? ""}`}>
      <Icon path={mdiTranslateVariant} />
      <span class="sr-only">{messageTranslate("common.language")}</span>
      <select
        aria-label={messageTranslate("common.language")}
        class="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        value={state.language()}
        onChange={state.onChange}
      >
        {state.options.map((option) => (
          <option value={option.code}>{option.nativeName}</option>
        ))}
      </select>
    </label>
  )
}
