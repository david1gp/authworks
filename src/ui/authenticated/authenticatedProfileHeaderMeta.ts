import { type JSX } from "@solidjs/web"

/** One label/value pair rendered in the profile header meta row. */
export type AuthenticatedProfileHeaderMeta = {
  readonly label: string
  readonly value: JSX.Element
}
