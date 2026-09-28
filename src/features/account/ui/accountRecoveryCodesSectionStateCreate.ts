import { useLocation, useNavigate } from "@solidjs/router"
import type { Accessor } from "solid-js"
import * as v from "valibot"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { accountRecoveryAccessStateCreate } from "./accountRecoveryAccessStateCreate.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

const recoveryDialogSchema = v.literal("open")

export function accountRecoveryCodesSectionStateCreate(security: Accessor<AccountSecurityViewState>) {
  const location = useLocation()
  const navigate = useNavigate()
  const access = accountRecoveryAccessStateCreate({
    methods: () => security().methods(),
    user: () => security().user(),
  })
  const remaining = () => security().methods().recoveryCodes.remaining
  const codesVisible = () => security().oneTimeCodes().length > 0
  const dialogOpen = () =>
    codesVisible() ||
    v.safeParse(recoveryDialogSchema, new URLSearchParams(location.search).get("accountRecoveryCodes")).success
  const dialogOpenChange = (open: boolean) => {
    // Issued codes are only returned once. Do not let backdrop, Escape or a pending request
    // hide them before the user explicitly acknowledges saving them.
    if (!open && (codesVisible() || security().pendingId() === "recovery:generate")) return
    const params = new URLSearchParams(location.search)
    if (open) params.set("accountRecoveryCodes", "open")
    else params.delete("accountRecoveryCodes")
    const search = params.toString()
    navigate(`${location.pathname}${search ? `?${search}` : ""}${location.hash}`, { replace: true, scroll: false })
  }
  const codesDismiss = () => {
    security().oneTimeCodesDismiss()
    dialogOpenChange(false)
  }

  return {
    codesDismiss,
    dialogOpen,
    dialogOpenChange,
    remaining,
    statuses: access.statuses,
    summaryStatus: () =>
      messageTranslate(remaining() > 0 ? "account.status.configured" : "account.status.notConfigured"),
    summaryTone: () => (remaining() > 0 ? ("success" as const) : ("neutral" as const)),
    summaryValue: () => messageTranslate("account.securityOverview.backupCodeCount", { count: remaining() }),
  }
}
