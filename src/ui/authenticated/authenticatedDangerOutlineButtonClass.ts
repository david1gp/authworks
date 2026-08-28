/**
 * Outlined destructive button language for authenticated surfaces. The vendored `outlineRed`
 * variant paints `text-red-500`, which fails contrast on the light surface, so secondary
 * destructive controls reuse the shared danger token in both themes instead.
 */
export const authenticatedDangerOutlineButtonClass =
  "border-danger/40 text-danger hover:bg-danger-soft dark:border-danger/40 dark:text-danger dark:hover:bg-danger-soft"
