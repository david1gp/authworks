import type { SignalObject } from "#ui/utils/createSignalObject.js"
import { type JSX } from "@solidjs/web"

export interface AuthenticatedSelectProps extends JSX.AriaAttributes {
  valueSignal: SignalObject<string>
  getOptions: () => string[]
  valueText?: (value: string) => string
  class?: string
  id?: string
  disabled?: boolean
}
