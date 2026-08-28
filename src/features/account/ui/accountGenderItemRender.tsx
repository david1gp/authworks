import { mdiGenderFemale } from "@adaptive-ds/mdi/mdiGenderFemale.js"
import { mdiGenderMale } from "@adaptive-ds/mdi/mdiGenderMale.js"
import { mdiGenderNonBinary } from "@adaptive-ds/mdi/mdiGenderNonBinary.js"
import { mdiHelpCircleOutline } from "@adaptive-ds/mdi/mdiHelpCircleOutline.js"
import type { JSX } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { accountGenderValueText } from "./accountGenderValueText.js"

function accountGenderIconPathGet(value: string): string {
  if (value === "woman") return mdiGenderFemale
  if (value === "man") return mdiGenderMale
  if (value === "non-binary") return mdiGenderNonBinary
  return mdiHelpCircleOutline
}

/** Renders one gender option with its icon inside the shared single-select control. */
export function accountGenderItemRender(value: string): JSX.Element {
  return (
    <span class="flex items-center gap-2">
      <Icon path={accountGenderIconPathGet(value)} />
      <span>{accountGenderValueText(value)}</span>
    </span>
  )
}
