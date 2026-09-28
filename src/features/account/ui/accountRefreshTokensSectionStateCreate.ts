import type { Accessor } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OidcRefreshTokenMetadata } from "../../oidc/public/oidcRefreshTokenMetadataSchema.js"

/** Counts describe loaded families only; a cursor can still hide additional applications. */
export function accountRefreshTokensSectionStateCreate(
  tokens: Accessor<readonly OidcRefreshTokenMetadata[]>,
  nextPageToken: Accessor<string | undefined>,
) {
  const selectedId = createSignalObject<string | undefined>(undefined)
  const allOpen = createSignalObject(false)
  const activeCount = () => tokens().filter((token) => token.status === "active").length
  const canRevokeAll = () => activeCount() > 0 || nextPageToken() !== undefined
  const dialogOpen = (id: string) => selectedId.get() === id && tokens().some((token) => token.familyId === id)
  const dialogOpenChange = (id: string, open: boolean) => {
    if (open) {
      if (!tokens().some((token) => token.familyId === id)) return
      allOpen.set(false)
      selectedId.set(id)
      return
    }
    if (selectedId.get() === id) selectedId.set(undefined)
  }
  const allDialogOpen = () => allOpen.get() && canRevokeAll()
  const allDialogOpenChange = (open: boolean) => {
    if (open && !canRevokeAll()) return
    if (open) selectedId.set(undefined)
    allOpen.set(open)
  }
  const tokenRevoke = (id: string, revoke: (id: string) => Promise<unknown>) => {
    if (!dialogOpen(id) || !tokens().some((token) => token.familyId === id && token.status === "active")) return
    void revoke(id)
  }
  const tokensRevokeAll = (revoke: () => Promise<unknown>) => {
    if (!allDialogOpen()) return
    void revoke()
  }

  return {
    activeCount,
    allDialogOpen,
    allDialogOpenChange,
    canRevokeAll,
    dialogOpen,
    dialogOpenChange,
    summaryStatus: () =>
      messageTranslate(
        activeCount() > 0
          ? "account.refreshTokens.activeShown"
          : nextPageToken() !== undefined
            ? "account.status.available"
            : "account.refreshTokens.noneActive",
        { count: activeCount() },
      ),
    summaryTone: () => (activeCount() > 0 ? ("success" as const) : ("neutral" as const)),
    summaryValue: () =>
      messageTranslate(
        tokens().length === 1 ? "account.refreshTokens.countOneShown" : "account.refreshTokens.countShown",
        {
          count: tokens().length,
        },
      ),
    tokenRevoke,
    tokensRevokeAll,
  }
}
