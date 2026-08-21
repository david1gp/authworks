import { LinkButtonExternal } from "#ui/interactive/link/LinkButton.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { emailPreviewFixtures } from "../fixtures/emailPreviewFixtures.js"

type EmailPreviewFixture = (typeof emailPreviewFixtures)[number]

export function EmailPreviewPage(props: { fixture: EmailPreviewFixture }) {
  return (
    <div class="mx-auto w-full max-w-6xl">
      <header class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="font-mono text-xs font-semibold text-accent">{props.fixture.contract}</p>
          <h1 class="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {messageTranslate(props.fixture.titleKey)}
          </h1>
          <p class="mt-2 text-muted-foreground">{props.fixture.message.subject}</p>
        </div>
        <LinkButtonExternal href="/demo/emails" variant="outline">
          {messageTranslate("email.preview.back")}
        </LinkButtonExternal>
      </header>

      <dl class="mb-6 grid gap-3 rounded-2xl border border-line bg-surface p-5 text-sm sm:grid-cols-2">
        <div>
          <dt class="font-medium text-muted-foreground">{messageTranslate("email.preview.recipient")}</dt>
          <dd class="mt-1 font-mono">{props.fixture.recipient}</dd>
        </div>
        <div>
          <dt class="font-medium text-muted-foreground">{messageTranslate("email.preview.subject")}</dt>
          <dd class="mt-1">{props.fixture.message.subject}</dd>
        </div>
      </dl>

      <div class="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <CardWrapper class="overflow-hidden p-0">
          <div class="border-b border-line px-5 py-4">
            <h2 class="font-semibold">{messageTranslate("email.preview.html")}</h2>
            <p class="mt-1 text-sm text-muted-foreground">{messageTranslate("email.preview.isolated")}</p>
          </div>
          <iframe
            class="h-[520px] w-full bg-white sm:h-[640px] xl:h-[720px]"
            sandbox=""
            referrerPolicy="no-referrer"
            srcdoc={props.fixture.message.html}
            title={`${messageTranslate(props.fixture.titleKey)} — ${messageTranslate("email.preview.html")}`}
          />
        </CardWrapper>
        <CardWrapper class="self-start overflow-hidden p-0">
          <h2 class="border-b border-line px-5 py-4 font-semibold">{messageTranslate("email.preview.text")}</h2>
          <pre class="whitespace-pre-wrap break-words p-5 font-sans text-sm leading-6 text-muted-foreground">
            {props.fixture.message.text}
          </pre>
        </CardWrapper>
      </div>
    </div>
  )
}
