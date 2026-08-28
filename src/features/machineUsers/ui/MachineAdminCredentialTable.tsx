import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { AuthenticatedPagination } from "../../../ui/authenticated/AuthenticatedPagination.js"
import { AuthenticatedRecordItem } from "../../../ui/authenticated/AuthenticatedRecordItem.js"
import { AuthenticatedRecordList } from "../../../ui/authenticated/AuthenticatedRecordList.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { authenticatedTableClasses } from "../../../ui/authenticated/authenticatedTableClasses.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { MachineCredential } from "../public/machineCredentialSchema.js"
import { MachineAdminScopeList } from "./MachineAdminScopeList.js"
import type { MachineAdminPageState } from "./machineAdminPageStateCreate.js"
import { machineCredentialStateTone } from "./machineCredentialStateTone.js"

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
  const label = messageTranslate("admin.machine.credentials.title")
  const credentialName = (credential: MachineCredential) =>
    credential.name ?? messageTranslate("admin.machine.credentials.unnamed")
  const expiry = (credential: MachineCredential) =>
    credential.expiresAt === undefined
      ? messageTranslate("admin.machine.credentials.neverExpires")
      : localeDateFormat(credential.expiresAt, { dateStyle: "medium" })
  const credentialStatus = (credential: MachineCredential) => (
    <AuthenticatedStatus
      label={messageTranslate(stateKeys[state.credentialState(credential)])}
      tone={machineCredentialStateTone(state.credentialState(credential))}
    />
  )
  // A revoked credential offers no further action; revocation is final.
  const revokeButton = (credential: MachineCredential) => (
    <Show when={state.credentialState(credential) !== "revoked"}>
      <Button
        disabled={state.pendingId() !== undefined}
        onClick={() => void state.credentialRevoke(credential.id)}
        size="sm"
        variant="filledRed"
      >
        {messageTranslate("admin.machine.credentials.revoke")}
      </Button>
    </Show>
  )

  return (
    <>
      <AuthenticatedRecordList label={label}>
        <For each={state.credentials()}>
          {(credential) => (
            <AuthenticatedRecordItem
              actions={revokeButton(credential)}
              fields={[
                {
                  label: messageTranslate("admin.machine.credentials.kind"),
                  value: messageTranslate(kindKeys[credential.kind]),
                },
                { label: messageTranslate("admin.machine.credentials.expires"), value: expiry(credential) },
                {
                  label: messageTranslate("admin.machine.created"),
                  value: localeDateFormat(credential.createdAt, { dateStyle: "medium" }),
                },
                {
                  label: messageTranslate("admin.machine.credentials.scopes"),
                  value: <MachineAdminScopeList scopes={credential.scopes} />,
                  wide: true,
                },
              ]}
              status={credentialStatus(credential)}
              title={credentialName(credential)}
            />
          )}
        </For>
      </AuthenticatedRecordList>

      <Table aria-label={label} class={authenticatedTableClasses.tableWide} tabIndex={0}>
        <TableHeader class={authenticatedTableClasses.header}>
          <TableRow>
            <TableHead class={authenticatedTableClasses.head}>
              {messageTranslate("admin.machine.credentials.name")}
            </TableHead>
            <TableHead class={authenticatedTableClasses.head}>
              {messageTranslate("admin.machine.credentials.kind")}
            </TableHead>
            <TableHead class={authenticatedTableClasses.head}>
              {messageTranslate("admin.machine.credentials.scopes")}
            </TableHead>
            <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.machine.created")}</TableHead>
            <TableHead class={authenticatedTableClasses.head}>
              {messageTranslate("admin.machine.credentials.expires")}
            </TableHead>
            <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.machine.status")}</TableHead>
            <TableHead class={authenticatedTableClasses.head}>
              <span class="sr-only">{messageTranslate("admin.machine.credentials.revoke")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <For each={state.credentials()}>
            {(credential) => (
              <TableRow class={authenticatedTableClasses.row} data-credential-id={credential.id}>
                <TableCell class={`${authenticatedTableClasses.cell} font-medium`}>
                  {credentialName(credential)}
                </TableCell>
                <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap`}>
                  {messageTranslate(kindKeys[credential.kind])}
                </TableCell>
                {/* Scopes are matched exactly, so they wrap in full rather than truncating. */}
                <TableCell class={`${authenticatedTableClasses.cell} max-w-[20rem]`}>
                  <MachineAdminScopeList scopes={credential.scopes} />
                </TableCell>
                <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap tabular-nums`}>
                  {localeDateFormat(credential.createdAt, { dateStyle: "medium" })}
                </TableCell>
                <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap tabular-nums`}>
                  {expiry(credential)}
                </TableCell>
                <TableCell class={authenticatedTableClasses.cell}>{credentialStatus(credential)}</TableCell>
                <TableCell class={authenticatedTableClasses.action}>{revokeButton(credential)}</TableCell>
              </TableRow>
            )}
          </For>
        </TableBody>
      </Table>

      <AuthenticatedPagination
        nextAvailable={state.hasNextPage()}
        onNext={state.pageNext}
        onPrevious={state.pagePrevious}
        previousAvailable={state.hasPreviousPage()}
      />
    </>
  )
}
