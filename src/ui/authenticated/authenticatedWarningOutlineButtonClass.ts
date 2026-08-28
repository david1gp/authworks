/**
 * Outlined caution button language for authenticated surfaces. The vendored `filledAmber` variant
 * paints a raw amber fill that is too light for its own label text, so guarded-but-primary actions
 * reuse the shared warning token in both themes instead.
 */
export const authenticatedWarningOutlineButtonClass =
  "border-warning/40 text-warning hover:bg-warning-soft dark:border-warning/40 dark:text-warning dark:hover:bg-warning-soft"
