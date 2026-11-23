import { omit } from "solid-js"
import { buttonCva2 } from "#ui/interactive/button/buttonCva.js"
import { buttonIconCva } from "#ui/interactive/button/buttonIconCva.js"
import type { ButtonAnchorProps } from "#ui/interactive/link/LinkButtonProps.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"

/** Shared styled button-anchor; base for both link variants. */
function ButtonAnchor(p: ButtonAnchorProps) {
  const rest = omit(
    p,
    "class",
    "variant",
    "newTab",
    "isLoading",
    "icon",
    "iconRight",
    "iconClass",
    "children",
    "target",
    "rel",
  )
  return (
    <a
      class={[
        buttonCva2(
          p.variant,
          "break-all", // line breaks for long links
          typeof p.class === "string" ? p.class : undefined,
        ),
        typeof p.class === "string" ? undefined : p.class,
      ]}
      target={p.newTab ? "_blank" : p.target}
      rel={p.newTab ? "noopener noreferrer" : p.rel}
      {...rest}
    >
      {p.icon && <Icon path={p.icon} class={buttonIconCva(p.variant, p.children && "mr-2", p.iconClass)} />}
      {p.children}
      {p.iconRight && <Icon path={p.iconRight} class={buttonIconCva(p.variant, p.children && "ml-2", p.iconClass)} />}
    </a>
  )
}

/** Internal button link — typed `to`, client-side nav + preload. Needs a RouterProvider. */
export function LinkButtonInternal(props: ButtonAnchorProps & { to: string }) {
  return <ButtonAnchor {...omit(props, "to")} href={props.to} />
}

/** External button link — plain `<a>` for external/runtime URLs. */
export function LinkButtonExternal(p: ButtonAnchorProps & { href: string }) {
  return <ButtonAnchor {...p} />
}
