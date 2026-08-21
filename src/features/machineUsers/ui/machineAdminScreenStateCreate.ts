import { useLocation, useNavigate } from "@solidjs/router"
import * as v from "valibot"
import type { MachineAdminAdapter } from "./machineAdminAdapter.js"
import { machineAdminCredentialsViewStateCreate } from "./machineAdminCredentialsViewStateCreate.js"
import { machineAdminDetailViewStateCreate } from "./machineAdminDetailViewStateCreate.js"
import { machineAdminListViewStateCreate } from "./machineAdminListViewStateCreate.js"
import { machineAdminPageStateCreate } from "./machineAdminPageStateCreate.js"
import type { MachineAdminIssuedSecret } from "./machineAdminIssuedSecret.js"
import type { MachineAdminScreen } from "./machineAdminScreenSchema.js"

const dialogSchema = v.picklist(["machine-user", "credential"])
const issueKindSchema = v.picklist(["api_key", "personal_access_token"])

/**
 * Wires the adapter-agnostic page state to URL-held view state so dialogs, search, the
 * selected credential subject, and the issue kind survive reloads and deep links.
 */
export function machineAdminScreenStateCreate(options: {
  readonly adapter: MachineAdminAdapter
  readonly basePath: string
  readonly confirm: (message: string) => boolean
  readonly issuedSecretSeed?: () => MachineAdminIssuedSecret | undefined
  readonly machineUserId: () => string | undefined
  readonly now: () => number
  readonly screen: () => MachineAdminScreen
}) {
  const location = useLocation()
  const navigate = useNavigate()

  const searchParamsSet = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(location.search)
    mutate(params)
    const encoded = params.toString()
    navigate(`${location.pathname}${encoded.length === 0 ? "" : `?${encoded}`}`, { replace: true })
  }
  const dialogOpen = (kind: v.InferOutput<typeof dialogSchema>) => {
    const parsed = v.safeParse(dialogSchema, new URLSearchParams(location.search).get("dialog"))
    return parsed.success && parsed.output === kind
  }
  const dialogOpenSet = (kind: v.InferOutput<typeof dialogSchema>) => (open: boolean) =>
    searchParamsSet((params) => {
      if (open) params.set("dialog", kind)
      else params.delete("dialog")
    })
  const search = () => new URLSearchParams(location.search).get("q") ?? ""
  const selectedMachineUserId = () => new URLSearchParams(location.search).get("machineUserId") ?? undefined
  const issueKind = () => {
    const parsed = v.safeParse(issueKindSchema, new URLSearchParams(location.search).get("kind"))
    return parsed.success ? parsed.output : "personal_access_token"
  }
  const issueKindSet = (kind: v.InferOutput<typeof issueKindSchema>) =>
    searchParamsSet((params) => params.set("kind", kind))

  // The detail screen takes its subject from the route; the overview takes it from the query.
  const machineUserId = () =>
    options.screen() === "machine-credentials" ? selectedMachineUserId() : options.machineUserId()

  const page = machineAdminPageStateCreate({
    adapter: options.adapter,
    confirm: options.confirm,
    ...(options.issuedSecretSeed === undefined ? {} : { issuedSecretSeed: options.issuedSecretSeed }),
    machineUserId,
    now: options.now,
    screen: options.screen,
  })

  return {
    credentials: machineAdminCredentialsViewStateCreate({
      issueKind,
      issueKindSet,
      issueOpen: () => dialogOpen("credential"),
      issueOpenSet: dialogOpenSet("credential"),
      machineUserId: selectedMachineUserId,
      machineUserIdSet: (id: string) => searchParamsSet((params) => params.set("machineUserId", id)),
      page,
    }),
    detail: machineAdminDetailViewStateCreate({
      issueKind,
      issueKindSet,
      issueOpen: () => dialogOpen("credential"),
      issueOpenSet: dialogOpenSet("credential"),
      onRemoved: () => navigate(`${options.basePath}/machine-users`),
      page,
    }),
    list: machineAdminListViewStateCreate({
      createOpen: () => dialogOpen("machine-user"),
      createOpenSet: dialogOpenSet("machine-user"),
      machineUserOpen: (id) => navigate(`${options.basePath}/machine-users/${id}`),
      page,
      search,
      searchSet: (value: string) =>
        searchParamsSet((params) => {
          if (value.length === 0) params.delete("q")
          else params.set("q", value)
        }),
    }),
    page,
    screen: options.screen,
  }
}
