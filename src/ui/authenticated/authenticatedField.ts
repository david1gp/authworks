import type { JSX } from "solid-js"

/** One label/value pair rendered by the dense authenticated field list. */
export type AuthenticatedField = {
  /** Renders the value in a monospace, breakable style for identifiers and technical values. */
  readonly identifier?: boolean
  readonly label: string
  readonly value: JSX.Element
  /** Spans the full field-list width instead of a single column. */
  readonly wide?: boolean
}
