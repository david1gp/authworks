import type { JSX } from "solid-js"
import type { SignalObject } from "#ui/utils/createSignalObject.js"

export interface AuthenticatedSelectProps extends JSX.AriaAttributes {
  valueSignal: SignalObject<string>
  getOptions: () => string[]
  valueText?: (value: string) => string
  class?: string
  id?: string
  disabled?: boolean
}
