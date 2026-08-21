export type ProductionApiContextValue = {
  readonly content: "empty" | "error" | "loading" | "ready"
  readonly errorMessage?: string
  readonly retry: () => void
}
