import { A } from "@solidjs/router"
import { For } from "solid-js"
import { BlueBulletPoint } from "#ui/static/lists/BlueBulletPoint.jsx"
import { PageWrapper } from "#ui/static/page/PageWrapper.jsx"
import { ThemeButton } from "#ui/interactive/theme/ThemeButton.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ttc } from "../../../ui/i18n/model/ttc.js"
import { LanguageSelector } from "../../../ui/i18n/ui/LanguageSelector.js"
import { demoAdminScenarioGroups } from "../demoAdminScenarioGroups.js"
import { demoConsentScenarioGroups } from "../demoConsentScenarioGroups.js"
import { demoLoginScenarioGroups } from "../demoLoginScenarioGroups.js"
import { emailPreviewFixtures } from "../../email/fixtures/emailPreviewFixtures.js"

type DemoHubLink = { href: string; label: () => string }
type DemoHubSection = { header: () => string; links: readonly DemoHubLink[] }

const demoHubSections: readonly DemoHubSection[] = [
  {
    header: () => messageTranslate("demo.nav.login"),
    links: demoLoginScenarioGroups.flatMap((group) =>
      group.scenarios.map((scenario) => ({ href: scenario.path, label: () => ttc(scenario.title) })),
    ),
  },
  {
    header: () => messageTranslate("demo.nav.account"),
    links: [
      { href: "/demo/account", label: () => messageTranslate("shell.nav.account") },
      { href: "/demo/invitations", label: () => messageTranslate("demo.account.scenario.invitations.title") },
      { href: "/demo/invitations/accept", label: () => messageTranslate("demo.account.scenario.invitation.title") },
    ],
  },
  {
    header: () => messageTranslate("demo.nav.admin"),
    links: demoAdminScenarioGroups.flatMap((group) =>
      group.scenarios.map((scenario) => ({ href: scenario.path, label: () => ttc(scenario.title) })),
    ),
  },
  {
    header: () => messageTranslate("shell.nav.applicationConsent"),
    links: demoConsentScenarioGroups.flatMap((group) =>
      group.scenarios.map((scenario) => ({ href: scenario.path, label: () => ttc(scenario.title) })),
    ),
  },
  {
    header: () => messageTranslate("email.directory.title"),
    links: emailPreviewFixtures.map((fixture) => ({
      href: `/demo/emails/${fixture.id}`,
      label: () => messageTranslate(fixture.titleKey),
    })),
  },
]

function DemoHubSectionLinks(props: { links: readonly DemoHubLink[] }) {
  return (
    <div class="flex flex-col">
      <For each={props.links}>
        {(link) => (
          <div class="flex flex-row flex-nowrap content-center">
            <BlueBulletPoint />
            <A class="break-all no-underline hover:underline" href={link.href}>
              {link.label()}
            </A>
          </div>
        )}
      </For>
    </div>
  )
}

export function DemoHub() {
  return (
    <div class="min-h-dvh bg-background">
      <header class="border-b border-line bg-surface/90 backdrop-blur">
        <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div class="flex min-w-0 items-center gap-4">
            <A class="font-semibold tracking-tight" href="/demo">
              {messageTranslate("app.name")}
            </A>
            <span class="hidden h-5 w-px bg-line sm:block" />
            <span class="hidden text-sm text-muted-foreground sm:block">{messageTranslate("demo.nav.hub")}</span>
          </div>
          <div class="flex min-w-0 items-center gap-2 sm:gap-3">
            <A
              class="hidden text-sm font-medium text-muted-foreground hover:text-foreground md:inline"
              href="/demo/login"
            >
              {messageTranslate("demo.nav.login")}
            </A>
            <A
              class="hidden text-sm font-medium text-muted-foreground hover:text-foreground md:inline"
              href="/demo/account"
            >
              {messageTranslate("demo.nav.account")}
            </A>
            <A
              class="hidden text-sm font-medium text-muted-foreground hover:text-foreground md:inline"
              href="/demo/invitations"
            >
              {messageTranslate("shell.nav.invitations")}
            </A>
            <A
              class="hidden text-sm font-medium text-muted-foreground hover:text-foreground md:inline"
              href="/demo/consent"
            >
              {messageTranslate("shell.nav.applicationConsent")}
            </A>
            <A
              class="hidden text-sm font-medium text-muted-foreground hover:text-foreground md:inline"
              href="/demo/admin/users"
            >
              {messageTranslate("demo.nav.admin")}
            </A>
            <LanguageSelector />
            <ThemeButton />
          </div>
        </div>
      </header>
      <PageWrapper innerClass="py-12 sm:py-16">
        <div class="mx-auto max-w-7xl">
          <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <For each={demoHubSections}>
              {(section) => (
                <section>
                  <h2 class="text-xl font-semibold">{section.header()}</h2>
                  <DemoHubSectionLinks links={section.links} />
                </section>
              )}
            </For>
          </div>
        </div>
      </PageWrapper>
    </div>
  )
}
