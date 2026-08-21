import { Match, Switch } from "solid-js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { DemoNav } from "../../demo/ui/DemoNav.js"
import { EmailDemoDirectory } from "./EmailDemoDirectory.js"
import { EmailPreviewPage } from "./EmailPreviewPage.js"
import type { emailDemoAppStateCreate } from "./emailDemoAppStateCreate.js"

type EmailDemoState = ReturnType<typeof emailDemoAppStateCreate>

export function EmailDemoScreen(props: { state: EmailDemoState }) {
  return (
    <div class="flex min-h-dvh flex-col gap-4 p-3 sm:p-4 lg:flex-row">
      <DemoNav compact={false} onNavigate={props.state.go} onToggle={() => undefined} />
      <main class="min-w-0 flex-1 py-2">
        <Switch
          fallback={
            <section class="mx-auto max-w-xl rounded-2xl border border-line bg-surface p-8 text-center">
              <h1 class="text-2xl font-semibold">{messageTranslate("email.preview.notFound")}</h1>
            </section>
          }
        >
          <Match when={props.state.isDirectory()}>
            <EmailDemoDirectory />
          </Match>
          <Match when={props.state.fixture()}>{(fixture) => <EmailPreviewPage fixture={fixture()} />}</Match>
        </Switch>
      </main>
    </div>
  )
}
