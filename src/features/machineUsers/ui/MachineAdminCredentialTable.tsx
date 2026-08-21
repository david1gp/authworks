import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { MachineAdminPagination } from "./MachineAdminPagination.js"
import { machineCredentialStateBadgeVariant } from "./machineCredentialStateBadgeVariant.js"
import type { MachineAdminPageState } from "./machineAdminPageStateCreate.js"

const kindKeys = {
  access_token: "admin.machine.credentials.kindAccessToken",
  api_key: "admin.machine.credentials.kindApiKey",
  client_secret: "admin.machine.credentials.kindClientSecret",
  personal_access_token: "admin.machine.credentials.kindToken",
} as const

const stateKeys = {
  active: "admin.machine.credentials.stateActive",
  expired: "admin.machine.credentials.stateExpired",
  revoked: "admin.machine.credentials.stateRevoked",
} as const

/** Lists credential metadata only. A stored secret value is never rendered here. */
export function MachineAdminCredentialTable(props: { readonly state: MachineAdminPageState }) {
  const state = props.state
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{messageTranslate("admin.machine.credentials.name")}</TableHead>
            <TableHead>{messageTranslate("admin.machine.credentials.kind")}</TableHead>
            <TableHead>{messageTranslate("admin.machine.credentials.scopes")}</TableHead>
            <TableHead>{messageTranslate("admin.machine.created")}</TableHead>
            <TableHead>{messageTranslate("admin.machine.credentials.expires")}</TableHead>
            <TableHead>{messageTranslate("admin.machine.status")}</TableHead>
            <TableHead class="text-right">{messageTranslate("admin.machine.credentials.revoke")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <For each={state.credentials()}>
            {(credential) => (
              <TableRow data-credential-id={credential.id}>
                <TableCell class="font-medium">
                  {credential.name ?? messageTranslate("admin.machine.credentials.unnamed")}
                </TableCell>
                <TableCell>{messageTranslate(kindKeys[credential.kind])}</TableCell>
                <TableCell class="max-w-56 truncate font-mono text-xs">{credential.scopes.join(", ")}</TableCell>
                <TableCell>{localeDateFormat(credential.createdAt, { dateStyle: "medium" })}</TableCell>
                <TableCell>
                  {credential.expiresAt === undefined
                    ? messageTranslate("admin.machine.credentials.neverExpires")
                    : localeDateFormat(credential.expiresAt, { dateStyle: "medium" })}
                </TableCell>
                <TableCell>
                  <Badge variant={machineCredentialStateBadgeVariant(state.credentialState(credential))}>
                    {messageTranslate(stateKeys[state.credentialState(credential)])}
                  </Badge>
                </TableCell>
                <TableCell class="text-right">
                  {/* A revoked credential offers no further action; revocation is final. */}
                  <Show when={state.credentialState(credential) !== "revoked"}>
                    <Button
                      disabled={state.pendingId() !== undefined}
                      onClick={() => void state.credentialRevoke(credential.id)}
                      variant="filledRed"
                    >
                      {messageTranslate("admin.machine.credentials.revoke")}
                    </Button>
                  </Show>
                </TableCell>
              </TableRow>
            )}
          </For>
        </TableBody>
      </Table>
      <MachineAdminPagination
        hasNext={state.hasNextPage()}
        hasPrevious={state.hasPreviousPage()}
        onNext={state.pageNext}
        onPrevious={state.pagePrevious}
      />
    </>
  )
}
