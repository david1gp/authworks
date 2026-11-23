import { mdiCheckboxBlankOutline } from "@adaptive-ds/mdi/mdiCheckboxBlankOutline.js"
import { mdiCheckboxMarked } from "@adaptive-ds/mdi/mdiCheckboxMarked.js"
import { omit } from "solid-js"
import { classesDisabledDirectly } from "#ui/classes/classesDisabledDirectly.js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { classMerge } from "#ui/utils/classMerge.js"
import type { MayHaveChildren } from "#ui/utils/MayHaveChildren.js"
import type { MayHaveClass } from "#ui/utils/MayHaveClass.js"
import type { MayHaveDisabled } from "#ui/utils/MayHaveDisabled.js"
import { type ComponentProps } from "@solidjs/web"

interface CheckboxProps extends MayHaveClass, MayHaveChildren, MayHaveDisabled, ComponentProps<"checkbox"> {
  id?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

/** Accessible labeled checkbox driven by a controlled `checked`/`onChange` pair. */
export function Checkbox(p: CheckboxProps) {
  const rest = omit(p, "id", "checked", "onChange", "disabled", "class", "children")
  const handleToggle = () => {
    if (p.disabled) return
    p.onChange(!p.checked)
  }

  return (
    <div class={classMerge("flex items-start gap-1", p.class)}>
      <input
        id={p.id}
        type="checkbox"
        checked={p.checked}
        onChange={(e) => p.onChange(e.currentTarget.checked)}
        class="sr-only invisible"
        disabled={p.disabled}
        aria-describedby={p.id ? `${p.id}-error` : undefined}
        {...rest}
      />
      <div
        onClick={handleToggle}
        class={classMerge(
          "size-6", // sizing + interaction
          "cursor-pointer", // cursor
          "flex items-center justify-center", // layout children
          p.disabled && classesDisabledDirectly, // disabled state
        )}
        role="checkbox"
        aria-checked={p.checked ? "true" : "false"}
        aria-labelledby={p.id ? `${p.id}-label` : undefined}
        tabindex={0}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault()
            handleToggle()
          }
        }}
      >
        <Icon path={p.checked ? mdiCheckboxMarked : mdiCheckboxBlankOutline} class="size-6 text-current" />
      </div>
      <label
        id={p.id ? `${p.id}-label` : undefined}
        for={p.id}
        class={classMerge(
          "cursor-pointer", // interaction
          p.disabled && classesDisabledDirectly, // disabled state
        )}
        onClick={(e) => {
          e.preventDefault()
          handleToggle()
        }}
      >
        {p.children}
      </label>
    </div>
  )
}
