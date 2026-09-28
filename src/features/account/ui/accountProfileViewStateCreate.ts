import { authenticatedSelectStateCreate } from "../../../ui/authenticated/authenticatedSelectStateCreate.js"
import { accountViewBoundaryStateGet } from "./accountViewBoundaryStateGet.js"
import type { AccountViewStatus } from "./accountViewStatusSchema.js"

export function accountProfileViewStateCreate(options: {
  readonly status: () => AccountViewStatus
  readonly errorMessage: () => string | undefined
  readonly firstName: () => string
  readonly lastName: () => string
  readonly displayName: () => string
}) {
  return {
    genderSelect: authenticatedSelectStateCreate(),
    boundary: () => accountViewBoundaryStateGet(options.status(), options.errorMessage()),
    personalSummary: () => [options.firstName(), options.lastName()].filter(Boolean).join(" ") || options.displayName(),
  }
}
