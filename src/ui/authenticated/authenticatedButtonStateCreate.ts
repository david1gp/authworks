import { mdiLoading } from "@adaptive-ds/mdi/mdiLoading.js"
import { type Accessor, type JSX, splitProps } from "solid-js"
import { classMerge } from "#ui/utils/classMerge.js"
import { authenticatedButtonClassGet } from "./authenticatedButtonClassGet.js"
import type { AuthenticatedButtonProps } from "./authenticatedButtonProps.js"

export function authenticatedButtonStateCreate(props: Accessor<AuthenticatedButtonProps>) {
  const [local, rest] = splitProps(props(), [
    "icon",
    "iconRight",
    "iconClass",
    "isLoading",
    "validationMessage",
    "validationVariant",
    "validationIcon",
    "variant",
    "size",
    "class",
    "disabled",
    "onClick",
    "children",
    "type",
    "aria-disabled",
  ])
  const blocked = () => Boolean(local.disabled || local.isLoading || local.validationMessage)
  const click: JSX.EventHandler<HTMLButtonElement, MouseEvent> = (event) => {
    if (blocked()) return
    const handler = local.onClick
    if (typeof handler === "function") {
      handler(event)
      return
    }
    if (handler) handler[0](handler[1], event)
  }

  return {
    rest,
    local,
    click,
    ariaDisabled: () => local["aria-disabled"] ?? blocked(),
    class: () =>
      authenticatedButtonClassGet(
        local.validationMessage ? local.validationVariant : local.variant,
        local.size,
        !local.children,
        (local.isLoading || Boolean(local.validationMessage)) && "cursor-not-allowed",
        local.class,
      ),
    icon: () => (local.isLoading ? mdiLoading : local.validationMessage ? local.validationIcon : local.icon),
    iconVisible: () => Boolean(local.isLoading || local.validationMessage || local.icon),
    iconClass: () => classMerge("size-4", local.isLoading && "animate-spin", local.iconClass),
    iconRightVisible: () => !local.isLoading && !local.validationMessage && Boolean(local.iconRight),
  }
}
