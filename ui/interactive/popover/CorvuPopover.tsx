import Popover, { type TriggerProps } from "@corvu-next/popover"
import { type Accessor, createSignal, omit, untrack } from "solid-js"
import { classesDisabledDirectly } from "#ui/classes/classesDisabledDirectly.js"
import { type ButtonCvaProps, buttonCva2 } from "#ui/interactive/button/buttonCva.js"
import { buttonIconCva } from "#ui/interactive/button/buttonIconCva.js"
import { classesButtonClickAnimation } from "#ui/interactive/button/classesButtonClickAnimation.js"
import { classesPopoverContentMerge } from "#ui/interactive/popover/classesPopoverContent.js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import type { MayHaveChildren } from "#ui/utils/MayHaveChildren.js"
import type { MayHaveClass } from "#ui/utils/MayHaveClass.js"
import type { MayHaveInnerClass } from "#ui/utils/MayHaveInnerClass.js"
import { type ComponentProps, type JSX } from "@solidjs/web"

export interface CorvuPopoverProps
  extends Omit<ComponentProps<"button">, "class" | "ref" | "type">,
    ButtonCvaProps,
    MayHaveClass,
    MayHaveInnerClass,
    MayHaveChildren,
    Pick<TriggerProps, "ref" | "type"> {
  icon?: string
  iconRight?: string
  iconClass?: string
  isDisabled?: Accessor<boolean>
  buttonChildren?: JSX.Element

  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/** Popover anchored to a labeled trigger button. */
export function CorvuPopover(p: CorvuPopoverProps) {
  const [trigger, setTrigger] = createSignal<HTMLElement>()
  const rest = omit(
    p,
    "ref",
    "variant",
    "class",
    "disabled",
    "isDisabled",
    "icon",
    "iconRight",
    "iconClass",
    "buttonChildren",
    "innerClass",
    "children",
    "open",
    "onOpenChange",
  )
  const disabled = () => p.disabled === "" || p.disabled === true || p.isDisabled?.()
  return (
    <Popover
      finalFocusEl={trigger()}
      floatingOptions={{
        offset: 8,
        flip: true,
        shift: true,
      }}
      open={p.open}
      onOpenChange={p.onOpenChange}
    >
      <Popover.Trigger
        {...rest}
        ref={(element) => {
          setTrigger(element)
          const ref = untrack(() => p.ref)
          if (typeof ref === "function") ref(element)
        }}
        disabled={disabled()}
        class={buttonCva2(p.variant, classesButtonClickAnimation, disabled() && classesDisabledDirectly, p.class)}
      >
        {p.icon && <Icon path={p.icon} class={buttonIconCva(p.variant, p.buttonChildren && "mr-2", p.iconClass)} />}
        {p.buttonChildren}
        {p.iconRight && (
          <Icon path={p.iconRight} class={buttonIconCva(p.variant, p.buttonChildren && "ml-2", p.iconClass)} />
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content class={classesPopoverContentMerge(p.innerClass)}>{p.children}</Popover.Content>
      </Popover.Portal>
    </Popover>
  )
}
