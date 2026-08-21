import { For } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OrganizationBranding } from "../public/organizationBrandingSchema.js"
import type { OrganizationBrandingTheme } from "../public/organizationBrandingThemeSchema.js"
import { OrganizationAdminNotice } from "./OrganizationAdminNotice.js"
import { OrganizationAdminState } from "./OrganizationAdminState.js"
import type { OrganizationAdminStatus } from "./organizationAdminStatusSchema.js"

type ThemeKey = "dark" | "light"
type ThemeColorKey = "backgroundColor" | "fontColor" | "primaryColor" | "warnColor"

const themeColorFields: readonly { key: ThemeColorKey; labelKey: Parameters<typeof messageTranslate>[0] }[] = [
  { key: "primaryColor", labelKey: "admin.organizations.branding.primary" },
  { key: "backgroundColor", labelKey: "admin.organizations.branding.background" },
  { key: "fontColor", labelKey: "admin.organizations.branding.font" },
  { key: "warnColor", labelKey: "admin.organizations.branding.warn" },
]

export function OrganizationAdminBrandingView(props: {
  readonly branding: OrganizationBranding
  readonly error?: string
  readonly notice?: string
  readonly onLegalUrlInput: (key: "privacyUrl" | "termsUrl", value: string) => void
  readonly onRetry: () => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly onThemeAssetInput: (theme: ThemeKey, key: "iconUrl" | "logoUrl", value: string) => void
  readonly onThemeColorInput: (theme: ThemeKey, key: ThemeColorKey, value: string) => void
  readonly onThemeModeInput: (value: "dark" | "light" | "system") => void
  readonly onWatermarkToggle: () => void
  readonly pendingId?: string
  readonly status: OrganizationAdminStatus
  readonly validationMessage?: string
}) {
  return (
    <section class="grid gap-5">
      <div>
        <h2 class="text-2xl font-semibold tracking-tight">{messageTranslate("admin.organizations.branding.title")}</h2>
        <p class="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          {messageTranslate("admin.organizations.branding.description")}
        </p>
      </div>
      <OrganizationAdminNotice notice={props.notice} />
      <OrganizationAdminState
        emptyDetail={messageTranslate("admin.organizations.branding.description")}
        error={props.error}
        onRetry={props.onRetry}
        status={props.status}
      >
        <form class="grid gap-5" onSubmit={props.onSubmit}>
          <div class="grid gap-5 lg:grid-cols-2">
            <For each={["light", "dark"] as const}>
              {(theme) => (
                <CardWrapper>
                  <h3 class="text-lg font-semibold">
                    {theme === "light"
                      ? messageTranslate("admin.organizations.branding.light")
                      : messageTranslate("admin.organizations.branding.dark")}
                  </h3>
                  <div class="mt-4 grid gap-4">
                    <For each={themeColorFields}>
                      {(field) => {
                        const id = `branding-${theme}-${field.key}`
                        const value = () => (props.branding[theme] as OrganizationBrandingTheme)[field.key]
                        return (
                          <div class="grid gap-2">
                            <Label for={id}>{messageTranslate(field.labelKey)}</Label>
                            <div class="flex items-center gap-3">
                              <input
                                aria-hidden="true"
                                class="size-9 cursor-pointer rounded border border-line bg-transparent"
                                onInput={(event) =>
                                  props.onThemeColorInput(theme, field.key, event.currentTarget.value)
                                }
                                tabindex={-1}
                                type="color"
                                value={value()}
                              />
                              <Input
                                class="max-w-40 font-mono"
                                id={id}
                                onInput={(event) =>
                                  props.onThemeColorInput(theme, field.key, event.currentTarget.value)
                                }
                                value={value()}
                              />
                            </div>
                          </div>
                        )
                      }}
                    </For>
                    <div class="grid gap-2">
                      <Label for={`branding-${theme}-logoUrl`}>
                        {messageTranslate("admin.organizations.branding.logoUrl")}
                      </Label>
                      <Input
                        id={`branding-${theme}-logoUrl`}
                        onInput={(event) => props.onThemeAssetInput(theme, "logoUrl", event.currentTarget.value)}
                        placeholder="https://"
                        value={(props.branding[theme] as OrganizationBrandingTheme).logoUrl ?? ""}
                      />
                    </div>
                    <div class="grid gap-2">
                      <Label for={`branding-${theme}-iconUrl`}>
                        {messageTranslate("admin.organizations.branding.iconUrl")}
                      </Label>
                      <Input
                        id={`branding-${theme}-iconUrl`}
                        onInput={(event) => props.onThemeAssetInput(theme, "iconUrl", event.currentTarget.value)}
                        placeholder="https://"
                        value={(props.branding[theme] as OrganizationBrandingTheme).iconUrl ?? ""}
                      />
                    </div>
                  </div>
                </CardWrapper>
              )}
            </For>
          </div>
          <CardWrapper>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="grid gap-2">
                <Label for="branding-theme-mode">{messageTranslate("admin.organizations.branding.themeMode")}</Label>
                <select
                  class="h-10 rounded-lg border border-line bg-surface px-3 text-sm"
                  id="branding-theme-mode"
                  onChange={(event) => props.onThemeModeInput(event.currentTarget.value as "dark" | "light" | "system")}
                  value={props.branding.themeMode}
                >
                  <option value="system">system</option>
                  <option value="light">light</option>
                  <option value="dark">dark</option>
                </select>
              </div>
              <div class="grid gap-2">
                <Label for="branding-terms">{messageTranslate("admin.organizations.branding.termsUrl")}</Label>
                <Input
                  id="branding-terms"
                  onInput={(event) => props.onLegalUrlInput("termsUrl", event.currentTarget.value)}
                  placeholder="https://"
                  value={props.branding.legal?.termsUrl ?? ""}
                />
              </div>
              <div class="grid gap-2">
                <Label for="branding-privacy">{messageTranslate("admin.organizations.branding.privacyUrl")}</Label>
                <Input
                  id="branding-privacy"
                  onInput={(event) => props.onLegalUrlInput("privacyUrl", event.currentTarget.value)}
                  placeholder="https://"
                  value={props.branding.legal?.privacyUrl ?? ""}
                />
              </div>
              <label class="mt-6 flex items-center gap-2 text-sm" for="branding-watermark">
                <input
                  checked={props.branding.disableWatermark}
                  class="size-4 rounded border-line"
                  id="branding-watermark"
                  onChange={props.onWatermarkToggle}
                  type="checkbox"
                />
                {messageTranslate("admin.organizations.branding.watermark")}
              </label>
            </div>
          </CardWrapper>
          <CardWrapper>
            <h3 class="text-lg font-semibold">{messageTranslate("admin.organizations.branding.preview")}</h3>
            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <For each={["light", "dark"] as const}>
                {(theme) => {
                  const themeBranding = () => props.branding[theme] as OrganizationBrandingTheme
                  return (
                    <div
                      class="rounded-xl border border-line p-6"
                      style={{ background: themeBranding().backgroundColor, color: themeBranding().fontColor }}
                    >
                      <p class="text-sm font-semibold">
                        {theme === "light"
                          ? messageTranslate("admin.organizations.branding.light")
                          : messageTranslate("admin.organizations.branding.dark")}
                      </p>
                      <p class="mt-3 text-xs opacity-80">{messageTranslate("app.name")}</p>
                      <span
                        class="mt-4 inline-block rounded-lg px-4 py-2 text-sm font-medium text-white"
                        style={{ background: themeBranding().primaryColor }}
                      >
                        {messageTranslate("common.signIn")}
                      </span>
                    </div>
                  )
                }}
              </For>
            </div>
          </CardWrapper>
          {props.validationMessage ? (
            <p class="text-sm text-danger" role="alert">
              {props.validationMessage}
            </p>
          ) : null}
          <div>
            <Button disabled={props.pendingId === "branding"} type="submit">
              {messageTranslate("common.save")}
            </Button>
          </div>
        </form>
      </OrganizationAdminState>
    </section>
  )
}
