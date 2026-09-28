import { accountViewBoundaryStateGet } from "./accountViewBoundaryStateGet.js"
import type { AccountViewStatus } from "./accountViewStatusSchema.js"

export function accountDeleteViewStateCreate(props: {
  readonly errorMessage?: string
  readonly status: AccountViewStatus
}) {
  return {
    boundary: () => accountViewBoundaryStateGet(props.status, props.errorMessage),
  }
}
