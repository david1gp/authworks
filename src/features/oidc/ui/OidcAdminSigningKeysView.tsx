import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { AuthenticatedPagination } from "../../../ui/authenticated/AuthenticatedPagination.js"
import { AuthenticatedRecordItem } from "../../../ui/authenticated/AuthenticatedRecordItem.js"
import { AuthenticatedRecordList } from "../../../ui/authenticated/AuthenticatedRecordList.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { AuthenticatedToolbar } from "../../../ui/authenticated/AuthenticatedToolbar.js"
import { authenticatedTableClasses } from "../../../ui/authenticated/authenticatedTableClasses.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OidcSigningKey } from "../public/oidcSigningKeySchema.js"
import { OidcAdminNotice } from "./OidcAdminNotice.js"
import { OidcAdminStateBoundary } from "./OidcAdminStateBoundary.js"
import type { OidcAdminPageState } from "./oidcAdminPageStateCreate.js"
import { oidcAdminSigningKeyStatusTone } from "./oidcAdminSigningKeyStatusTone.js"

export function OidcAdminSigningKeysView(props: { readonly state: OidcAdminPageState }) {
  const state = props.state
  const retiredAt = (key: OidcSigningKey) =>
    key.retiredAt === null ? "—" : localeDateFormat(key.retiredAt, { dateStyle: "medium" })
  const retireButton = (key: OidcSigningKey) => (
    <Show when={key.status === "active"}>
      <Button
        disabled={state.pendingId() !== undefined}
        onClick={() => void state.signingKeyRetire(key.id)}
        size="sm"
        variant="outline"
      >
        {messageTranslate("admin.oidc.keys.retire")}
      </Button>
    </Show>
  )

  return (
    <section aria-label={messageTranslate("admin.oidc.keys.title")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <AuthenticatedToolbar
        actions={
          <>
            <Button
              disabled={state.pendingId() !== undefined}
              onClick={() => void state.signingKeyCreate()}
              size="sm"
              variant="outline"
            >
              {messageTranslate("admin.oidc.keys.create")}
            </Button>
            <Button
              disabled={state.pendingId() !== undefined}
              onClick={() => void state.signingKeyRotate()}
              size="sm"
              variant="filledBlue"
            >
              {messageTranslate("admin.oidc.keys.rotate")}
            </Button>
          </>
        }
        label={messageTranslate("admin.oidc.keys.title")}
        summary={messageTranslate("admin.oidc.keys.privateNotice")}
      />

      <OidcAdminNotice notice={state.notice()} />

      <OidcAdminStateBoundary
        emptyDetail={messageTranslate("admin.oidc.keys.empty")}
        error={state.error()}
        onRetry={state.reload}
        status={state.status()}
      >
        <AuthenticatedSection>
          <AuthenticatedRecordList label={messageTranslate("admin.oidc.keys.title")}>
            <For each={state.signingKeys()}>
              {(key) => (
                <AuthenticatedRecordItem
                  actions={retireButton(key)}
                  fields={[
                    { label: messageTranslate("admin.oidc.keys.algorithm"), value: key.algorithm },
                    {
                      label: messageTranslate("admin.oidc.created"),
                      value: localeDateFormat(key.createdAt, { dateStyle: "medium" }),
                    },
                    { label: messageTranslate("admin.oidc.keys.retiredAt"), value: retiredAt(key) },
                  ]}
                  status={
                    <AuthenticatedStatus
                      label={messageTranslate(`admin.oidc.keys.statusValue.${key.status}`)}
                      tone={oidcAdminSigningKeyStatusTone(key.status)}
                    />
                  }
                  title={
                    <span class="block truncate font-mono text-xs" title={key.publicJwk.kid}>
                      {key.publicJwk.kid}
                    </span>
                  }
                />
              )}
            </For>
          </AuthenticatedRecordList>

          <Table
            aria-label={messageTranslate("admin.oidc.keys.title")}
            class={authenticatedTableClasses.tableWide}
            tabIndex={0}
          >
            <TableHeader class={authenticatedTableClasses.header}>
              <TableRow>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.oidc.keys.keyId")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.oidc.keys.algorithm")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.oidc.status")}</TableHead>
                <TableHead class={authenticatedTableClasses.head}>{messageTranslate("admin.oidc.created")}</TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.oidc.keys.retiredAt")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  <span class="sr-only">{messageTranslate("admin.oidc.keys.retire")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={state.signingKeys()}>
                {(key) => (
                  <TableRow class={authenticatedTableClasses.row}>
                    {/* Key identifiers are long UUIDs, so the cell truncates and keeps the full value in its title. */}
                    <TableCell class={authenticatedTableClasses.identifier} title={key.publicJwk.kid}>
                      {key.publicJwk.kid}
                    </TableCell>
                    <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap`}>{key.algorithm}</TableCell>
                    <TableCell class={authenticatedTableClasses.cell}>
                      <AuthenticatedStatus
                        label={messageTranslate(`admin.oidc.keys.statusValue.${key.status}`)}
                        tone={oidcAdminSigningKeyStatusTone(key.status)}
                      />
                    </TableCell>
                    <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap tabular-nums`}>
                      {localeDateFormat(key.createdAt, { dateStyle: "medium" })}
                    </TableCell>
                    <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap tabular-nums`}>
                      {retiredAt(key)}
                    </TableCell>
                    <TableCell class={authenticatedTableClasses.action}>{retireButton(key)}</TableCell>
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
        </AuthenticatedSection>
      </OidcAdminStateBoundary>
    </section>
  )
}
