import { type ButtonVariant, buttonCva2 } from "#ui/interactive/button/buttonCva.js"
import { classesButtonClickAnimation } from "#ui/interactive/button/classesButtonClickAnimation.js"
import { authenticatedButtonClassGet } from "./authenticatedButtonClassGet.js"
import type { AuthenticatedButtonVariant } from "./authenticatedButtonVariant.js"

type AuthenticatedDialogLegacyVariant = Exclude<ButtonVariant, AuthenticatedButtonVariant>

/**
 * Exhaustive guard: every vendored variant outside the five authenticated ones
 * keeps its exact legacy `buttonCva2` output. Adding a variant to
 * `ButtonVariant` without listing it here fails typecheck.
 */
const authenticatedDialogLegacyVariants: Record<AuthenticatedDialogLegacyVariant, true> = {
  none: true,
  link: true,
  filled: true,
  subtle: true,
  contrast: true,
  filledYellow: true,
  filledAmber: true,
  filledOrange: true,
  filledGreen: true,
  filledSky: true,
  filledIndigo: true,
  filledGreenGradient: true,
  filledYellowGradient: true,
  filledAmberGradient: true,
  filledOrangeGradient: true,
  filledRedGradient: true,
  filledSkyGradient: true,
  filledBlueGradient: true,
  filledBlueGreenGradient: true,
  filledIndigoGradient: true,
}

/** Authenticated variants share the single button recipe; legacy variants keep exact vendored output. */
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
  const legacy: AuthenticatedDialogLegacyVariant = variant
  void authenticatedDialogLegacyVariants[legacy]
  return buttonCva2(legacy, classesButtonClickAnimation, customClass)
}
