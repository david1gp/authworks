import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedPagination } from "../../../ui/authenticated/AuthenticatedPagination.js"
import { AuthenticatedPageBody } from "../../../ui/authenticated/AuthenticatedPageBody.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OrganizationDomain } from "../public/organizationDomainSchema.js"
import { OrganizationAdminNotice } from "./OrganizationAdminNotice.js"
import { OrganizationAdminState } from "./OrganizationAdminState.js"
import type { OrganizationAdminStatus } from "./organizationAdminStatusSchema.js"

export function OrganizationAdminDomainsView(props: {
  readonly claimDomain: string
  readonly claimPrimary: boolean
  readonly discoveryDomain: string
  readonly discoveryMessage?: string
  readonly domains: readonly OrganizationDomain[]
  readonly error?: string
  readonly nextPageAvailable: boolean
  readonly notice?: string
  readonly onClaimDomainInput: (value: string) => void
  readonly onClaimPrimaryToggle: () => void
  readonly onClaimSubmit: (event: SubmitEvent) => void
  readonly onDiscoveryDomainInput: (value: string) => void
  readonly onDiscoverySubmit: (event: SubmitEvent) => void
  readonly onNextPage: () => void
  readonly onPreviousPage: () => void
  readonly onRemove: (domain: string) => void
  readonly onRetry: () => void
  readonly onVerify: (domain: string) => void
  readonly pendingId?: string
  readonly previousPageAvailable: boolean
  readonly status: OrganizationAdminStatus
  readonly validationMessage?: string
}) {
  return (
    <AuthenticatedPageBody>
      <OrganizationAdminNotice notice={props.notice} />

      <div class="grid min-w-0 gap-3 lg:grid-cols-2 [&>*]:min-w-0">
        <AuthenticatedSection
          description={messageTranslate("admin.organizations.domains.description")}
          title={messageTranslate("admin.organizations.domains.claim")}
        >
          <form class="grid gap-3 px-3 py-3" onSubmit={props.onClaimSubmit}>
            <div class="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div class="grid min-w-0 gap-1">
                <Label for="domain-claim">{messageTranslate("admin.organizations.domains.domain")}</Label>
                <Input
                  id="domain-claim"
                  onInput={(event) => props.onClaimDomainInput(event.currentTarget.value)}
                  placeholder={messageTranslate("admin.organizations.domains.placeholder")}
                  value={props.claimDomain}
                />
              </div>
              <Button disabled={props.pendingId === "domain:claim"} size="sm" type="submit">
                {messageTranslate("admin.organizations.domains.claim")}
              </Button>
            </div>
            <label class="flex items-center gap-2 text-xs font-medium" for="domain-claim-primary">
              <input
                checked={props.claimPrimary}
                class="size-4 rounded border-line"
                id="domain-claim-primary"
                onChange={props.onClaimPrimaryToggle}
                type="checkbox"
              />
              {messageTranslate("admin.organizations.domains.primary")}
            </label>
            <Show when={props.validationMessage}>
              {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
            </Show>
          </form>
        </AuthenticatedSection>

        <AuthenticatedSection
          description={messageTranslate("admin.organizations.domains.discoveryDescription")}
          title={messageTranslate("admin.organizations.domains.discovery")}
        >
          <form class="grid gap-3 px-3 py-3" onSubmit={props.onDiscoverySubmit}>
            <div class="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div class="grid min-w-0 gap-1">
                <Label for="domain-discovery">{messageTranslate("admin.organizations.domains.domain")}</Label>
                <Input
                  id="domain-discovery"
                  onInput={(event) => props.onDiscoveryDomainInput(event.currentTarget.value)}
                  placeholder={messageTranslate("admin.organizations.domains.placeholder")}
                  value={props.discoveryDomain}
                />
              </div>
              <Button disabled={props.pendingId === "domain:discover"} size="sm" type="submit" variant="outline">
                {messageTranslate("admin.organizations.domains.discovery")}
              </Button>
            </div>
            <Show when={props.discoveryMessage}>
              {(message) => (
                <p
                  class="rounded-control border border-line-subtle bg-muted px-2 py-1.5 text-xs text-muted-foreground"
                  role="status"
                >
                  {message()}
                </p>
              )}
            </Show>
          </form>
        </AuthenticatedSection>
      </div>

      <OrganizationAdminState
        emptyDetail={messageTranslate("admin.organizations.domains.empty")}
        error={props.error}
        onRetry={props.onRetry}
        status={props.status}
      >
        <AuthenticatedSection title={messageTranslate("admin.organizations.domains.title")}>
          <ul aria-label={messageTranslate("admin.organizations.domains.title")} class="divide-y divide-line-subtle">
            <For each={props.domains}>
              {(domain) => (
                <li class="grid min-w-0 gap-2 px-3 py-2.5">
                  <div class="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                    <div class="flex min-w-0 flex-wrap items-center gap-2">
                      <h3 class="min-w-0 truncate text-sm font-medium">{domain.domain}</h3>
                      <AuthenticatedStatus
                        label={
                          domain.verified
                            ? messageTranslate("admin.organizations.domains.verified")
                            : messageTranslate("admin.organizations.domains.unverified")
                        }
                        tone={domain.verified ? "success" : "warning"}
                      />
                      <Show when={domain.isPrimary}>
                        <AuthenticatedStatus
                          label={messageTranslate("admin.organizations.domains.primary")}
                          tone="accent"
                        />
                      </Show>
                    </div>
                    <div class="flex flex-wrap items-center gap-1.5">
                      <Show when={!domain.verified}>
                        <Button
                          disabled={props.pendingId === `domain:${domain.domain}`}
                          onClick={() => props.onVerify(domain.domain)}
                          size="sm"
                        >
                          {messageTranslate("admin.organizations.domains.verify")}
                        </Button>
                      </Show>
                      <Button
                        disabled={props.pendingId === `domain:${domain.domain}`}
                        onClick={() => props.onRemove(domain.domain)}
                        size="sm"
                        variant="outline"
                      >
                        {messageTranslate("admin.organizations.domains.remove")}
                      </Button>
                    </div>
                  </div>
                  <Show when={domain.verification}>
                    {(verification) => (
                      <div class="min-w-0 rounded-control border border-line-subtle bg-muted px-2 py-1.5">
                        <p class="text-2xs font-semibold tracking-[0.12em] uppercase text-muted-foreground">
                          {messageTranslate("admin.organizations.domains.verificationRecord")}
                        </p>
                        <p class="mt-0.5 break-all font-mono text-xs">
                          {verification().recordType} {verification().recordName} {verification().recordValue}
                        </p>
                      </div>
                    )}
                  </Show>
                </li>
              )}
            </For>
          </ul>

          <AuthenticatedPagination
            nextAvailable={props.nextPageAvailable}
            onNext={props.onNextPage}
            onPrevious={props.onPreviousPage}
            previousAvailable={props.previousPageAvailable}
          />
        </AuthenticatedSection>
      </OrganizationAdminState>
    </AuthenticatedPageBody>
  )
}
