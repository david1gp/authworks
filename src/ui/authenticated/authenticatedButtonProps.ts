import type { ComponentProps } from "solid-js"
import type { AuthenticatedButtonSize } from "./authenticatedButtonSize.js"
import type { AuthenticatedButtonVariant } from "./authenticatedButtonVariant.js"

export interface AuthenticatedButtonProps extends ComponentProps<"button"> {
  variant?: AuthenticatedButtonVariant
  size?: AuthenticatedButtonSize
  icon?: string
  iconRight?: string
  iconClass?: string
  isLoading?: boolean
  validationMessage?: string
  validationVariant?: AuthenticatedButtonVariant
  validationIcon?: string
}
