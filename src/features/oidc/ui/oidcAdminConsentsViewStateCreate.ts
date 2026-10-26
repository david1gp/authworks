import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { OidcAdminPageState } from "./oidcAdminPageStateCreate.js"

/** View state for administrator consent review: choosing a subject and revoking a grant. */
export function oidcAdminConsentsViewStateCreate(options: {
  readonly consentUserId: () => string | undefined
  readonly consentUserIdSet: (userId: string) => void
  readonly page: OidcAdminPageState
}) {
  const selectedUserId = createSignalObject("")

  const activeUserId = () => options.consentUserId() ?? options.page.users()[0]?.id ?? ""

  return {
    activeUserId,
    consentRevoke: (clientId: string) => void options.page.consentRevoke(activeUserId(), clientId),
    page: options.page,
    userHasNextPage: options.page.userHasNextPage,
    userHasPreviousPage: options.page.userHasPreviousPage,
    userIdSignal: {
      get: () => (selectedUserId.get() === "" ? activeUserId() : selectedUserId.get()),
      set: (userId: string) => {
        selectedUserId.set(userId)
        options.consentUserIdSet(userId)
      },
    },
    userPageNext: options.page.userPageNext,
    userPagePrevious: options.page.userPagePrevious,
    userSearch: options.page.userSearch,
    userSearchSet: options.page.userSearchSet,
  }
}
