import { type ButtonVariant, buttonCva2 } from "#ui/interactive/button/buttonCva.js"
import { classesButtonClickAnimation } from "#ui/interactive/button/classesButtonClickAnimation.js"
import { authenticatedButtonClassGet } from "./authenticatedButtonClassGet.js"

/** Retain uncommon legacy variants while sharing authenticated controls by default. */
export function authenticatedDialogTriggerClassGet(variant: ButtonVariant = "ghost", customClass?: string) {
  if (
    variant === "filledBlue" ||
    variant === "outline" ||
    variant === "ghost" ||
    variant === "filledRed" ||
    variant === "outlineRed"
  ) {
    return authenticatedButtonClassGet(variant, "md", false, customClass)
  }
  return buttonCva2(variant, undefined, classesButtonClickAnimation, customClass)
}
