import { LinkButtonExternal } from "#ui/interactive/link/LinkButton.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { emailPreviewFixtures } from "../fixtures/emailPreviewFixtures.js"

export function EmailDemoDirectory() {
  return (
    <div class="mx-auto w-full max-w-6xl">
      <header class="relative overflow-hidden rounded-3xl border border-blue-200/70 bg-gradient-to-br from-blue-50 via-surface to-indigo-50 px-6 py-9 shadow-sm dark:border-blue-900/60 dark:from-blue-950/35 dark:via-surface dark:to-indigo-950/25 sm:px-10 sm:py-12">
        <div class="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-300/20 blur-3xl dark:bg-blue-500/10" />
        <div class="relative max-w-3xl">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-accent">
            {messageTranslate("email.directory.eyebrow")}
          </p>
          <h1 class="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
            {messageTranslate("email.directory.title")}
          </h1>
          <p class="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            {messageTranslate("email.directory.description")}
          </p>
        </div>
      </header>
      <div class="mt-8 grid gap-5 md:grid-cols-2">
        {emailPreviewFixtures.map((fixture) => (
          <CardWrapper class="flex flex-col gap-4 p-6">
            <div class="flex-1">
              <p class="font-mono text-xs font-semibold text-accent">{fixture.contract}</p>
              <h2 class="mt-2 text-2xl font-semibold">{messageTranslate(fixture.titleKey)}</h2>
              <p class="mt-2 text-muted-foreground">{fixture.message.subject}</p>
            </div>
            <div>
              <LinkButtonExternal href={`/demo/emails/${fixture.id}`} variant="filledBlue">
                {messageTranslate("email.directory.open")}
              </LinkButtonExternal>
            </div>
          </CardWrapper>
        ))}
      </div>
    </div>
  )
}
