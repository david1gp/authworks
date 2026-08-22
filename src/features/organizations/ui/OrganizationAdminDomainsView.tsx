import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OrganizationDomain } from "../public/organizationDomainSchema.js"
import { OrganizationAdminNotice } from "./OrganizationAdminNotice.js"
import { OrganizationAdminPagination } from "./OrganizationAdminPagination.js"
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
    <section class="grid gap-5">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">{messageTranslate("admin.organizations.domains.title")}</h1>
        <p class="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          {messageTranslate("admin.organizations.domains.description")}
        </p>
      </div>
      <OrganizationAdminNotice notice={props.notice} />
      <CardWrapper>
        <h3 class="text-lg font-semibold">{messageTranslate("admin.organizations.domains.claim")}</h3>
        <form class="mt-4 grid gap-4" onSubmit={props.onClaimSubmit}>
          <div class="grid gap-2">
            <Label for="domain-claim">{messageTranslate("admin.organizations.domains.domain")}</Label>
            <Input
              class="max-w-md"
              id="domain-claim"
              onInput={(event) => props.onClaimDomainInput(event.currentTarget.value)}
              placeholder={messageTranslate("admin.organizations.domains.placeholder")}
              value={props.claimDomain}
            />
          </div>
          <label class="flex items-center gap-2 text-sm" for="domain-claim-primary">
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
            {(message) => (
              <p class="text-sm text-danger" role="alert">
                {message()}
              </p>
            )}
          </Show>
          <div>
            <Button disabled={props.pendingId === "domain:claim"} type="submit">
              {messageTranslate("admin.organizations.domains.claim")}
            </Button>
          </div>
        </form>
      </CardWrapper>
      <OrganizationAdminState
        emptyDetail={messageTranslate("admin.organizations.domains.empty")}
        error={props.error}
        onRetry={props.onRetry}
        status={props.status}
      >
        <div class="grid gap-4">
          <For each={props.domains}>
            {(domain) => (
              <CardWrapper>
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <h3 class="font-semibold">{domain.domain}</h3>
                      <Badge variant={domain.verified ? "filledGreen" : "filledYellow"}>
                        {domain.verified
                          ? messageTranslate("admin.organizations.domains.verified")
                          : messageTranslate("admin.organizations.domains.unverified")}
                      </Badge>
                      <Show when={domain.isPrimary}>
                        <Badge variant="filledBlue">{messageTranslate("admin.organizations.domains.primary")}</Badge>
                      </Show>
                    </div>
                    <Show when={domain.verification}>
                      {(verification) => (
                        <div class="mt-3 rounded-lg bg-muted p-3 text-xs">
                          <p class="text-muted-foreground">
                            {messageTranslate("admin.organizations.domains.verificationRecord")}
                          </p>
                          <p class="mt-2 break-all font-mono">
                            {verification().recordType} {verification().recordName} {verification().recordValue}
                          </p>
                        </div>
                      )}
                    </Show>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <Show when={!domain.verified}>
                      <Button
                        disabled={props.pendingId === `domain:${domain.domain}`}
                        onClick={() => props.onVerify(domain.domain)}
                      >
                        {messageTranslate("admin.organizations.domains.verify")}
                      </Button>
                    </Show>
                    <Button
                      disabled={props.pendingId === `domain:${domain.domain}`}
                      onClick={() => props.onRemove(domain.domain)}
                      variant="outline"
                    >
                      {messageTranslate("admin.organizations.domains.remove")}
                    </Button>
                  </div>
                </div>
              </CardWrapper>
            )}
          </For>
          <OrganizationAdminPagination
            nextAvailable={props.nextPageAvailable}
            onNext={props.onNextPage}
            onPrevious={props.onPreviousPage}
            previousAvailable={props.previousPageAvailable}
          />
        </div>
      </OrganizationAdminState>
      <CardWrapper>
        <h3 class="text-lg font-semibold">{messageTranslate("admin.organizations.domains.discovery")}</h3>
        <p class="mt-1 text-sm text-muted-foreground">
          {messageTranslate("admin.organizations.domains.discoveryDescription")}
        </p>
        <form class="mt-4 flex flex-wrap items-end gap-3" onSubmit={props.onDiscoverySubmit}>
          <div class="grid flex-1 gap-2">
            <Label for="domain-discovery">{messageTranslate("admin.organizations.domains.domain")}</Label>
            <Input
              id="domain-discovery"
              onInput={(event) => props.onDiscoveryDomainInput(event.currentTarget.value)}
              value={props.discoveryDomain}
            />
          </div>
          <Button disabled={props.pendingId === "domain:discover"} type="submit" variant="outline">
            {messageTranslate("admin.organizations.domains.discovery")}
          </Button>
        </form>
        <Show when={props.discoveryMessage}>
          {(message) => (
            <p class="mt-4 rounded-lg border border-line bg-muted px-4 py-3 text-sm" role="status">
              {message()}
            </p>
          )}
        </Show>
      </CardWrapper>
    </section>
  )
}
