import { type ButtonVariant, buttonCva2 } from "#ui/interactive/button/buttonCva.js"
import { classesButtonClickAnimation } from "#ui/interactive/button/classesButtonClickAnimation.js"
import { authenticatedButtonClassGet } from "./authenticatedButtonClassGet.js"

/** Retain uncommon legacy variants while sharing authenticated controls by default. */
export function authenticatedDialogTriggerClassGet(
  variant: ButtonVariant = "ghost",
  customClass?: string,
  size: "sm" | "md" = "md",
) {
  if (
    variant === "filledBlue" ||
    variant === "outline" ||
    variant === "ghost" ||
    variant === "filledRed" ||
    variant === "outlineRed"
  ) {
    return authenticatedButtonClassGet(variant, size, false, customClass)
  }
  return buttonCva2(variant, size === "sm" ? "sm" : undefined, classesButtonClickAnimation, customClass)
}
