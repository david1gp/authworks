import { useLocation, useNavigate } from "@solidjs/router"
import * as v from "valibot"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OidcConsent } from "../../oidc/public/oidcConsentSchema.js"
import { accountAccessBoundaryStateGet } from "./accountAccessBoundaryStateGet.js"
import type { AccountAccessStatus } from "./accountAccessStatusSchema.js"

/** Presentation only: the adapters still own consent loading, confirmation and revocation. */
export function accountConsentsViewStateCreate(inputs: {
  readonly consents: () => readonly OidcConsent[]
  readonly error: () => string | undefined
  readonly onRevoke: (clientId: string) => void | Promise<void>
  readonly pendingId: () => string | undefined
  readonly status: () => AccountAccessStatus
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const revoking = createSignalObject(false)
  const boundary = () => {
    const state = accountAccessBoundaryStateGet(inputs.status(), {
      emptyDetail: messageTranslate("account.access.consentEmpty"),
      error: inputs.error(),
    })
    if (state.state === "empty") return { state: "ready" as const }
    return state
  }
  const selectedId = () => {
    // Validate against the supplied records: demo clients use slugs, production clients use UUIDs.
    const parsed = v.safeParse(
      v.picklist(inputs.consents().map((consent) => consent.clientId)),
      new URLSearchParams(location.search).get("accountConsent"),
    )
    return parsed.success ? parsed.output : undefined
  }
  const selectionReplace = (clientId: string | undefined) => {
    const params = new URLSearchParams(location.search)
    params.delete("accountConsent")
    if (clientId !== undefined) params.set("accountConsent", clientId)
    const search = params.toString()
    navigate(`${location.pathname}${search ? `?${search}` : ""}${location.hash}`, { replace: true, scroll: false })
  }
  const dialogOpen = (clientId: string) => boundary().state === "ready" && selectedId() === clientId
  const dialogOpenChange = (clientId: string, open: boolean) => {
    if (open) {
      if (boundary().state !== "ready" || !inputs.consents().some((consent) => consent.clientId === clientId)) return
      selectionReplace(clientId)
      return
    }
    if (new URLSearchParams(location.search).get("accountConsent") === clientId) selectionReplace(undefined)
  }
  const revokeDisabled = (clientId: string) =>
    !dialogOpen(clientId) || inputs.pendingId() !== undefined || revoking.get()
  const consentRevoke = async (clientId: string) => {
    if (revokeDisabled(clientId)) return
    revoking.set(true)
    await inputs.onRevoke(clientId)
    revoking.set(false)
    // Cancellation and failure retain the details; only a removed consent clears its selection.
    if (
      !inputs.consents().some((consent) => consent.clientId === clientId) &&
      new URLSearchParams(location.search).get("accountConsent") === clientId
    )
      selectionReplace(undefined)
  }

  return {
    boundary,
    consentRevoke,
    dialogOpen,
    dialogOpenChange,
    revokeDisabled,
    summaryValue: () => {
      if (boundary().state === "loading") return messageTranslate("common.loading")
      if (boundary().state === "error") return messageTranslate("account.access.error")
      if (boundary().state === "inaccessible") return messageTranslate("account.status.unavailable")
      return messageTranslate(
        inputs.consents().length === 1 ? "account.access.consentCountOne" : "account.access.consentCount",
        { count: inputs.consents().length },
      )
    },
  }
}
