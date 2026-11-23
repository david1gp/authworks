import type { ButtonIconProps } from "#ui/interactive/button/ButtonIcon.jsx"
import type { AuthenticatedButtonSize } from "./authenticatedButtonSize.js"
import type { AuthenticatedButtonVariant } from "./authenticatedButtonVariant.js"

/** Shared icon/loading/validation contract; only the visual variants are re-themed. */
export interface AuthenticatedButtonProps extends Omit<ButtonIconProps, "class" | "variant" | "validationVariant"> {
  class?: string
  variant?: AuthenticatedButtonVariant
  size?: AuthenticatedButtonSize
  validationVariant?: AuthenticatedButtonVariant
}
