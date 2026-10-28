import { A } from "@solidjs/router"
import { For } from "solid-js"
import { BlueBulletPoint } from "#ui/static/lists/BlueBulletPoint.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { emailPreviewFixtures } from "../fixtures/emailPreviewFixtures.js"

export function EmailDemoDirectory() {
  return (
    <div class="mx-auto w-full max-w-7xl">
      <section>
        <h2 class="text-xl font-semibold">{messageTranslate("email.directory.title")}</h2>
        <div class="flex flex-col">
          <For each={emailPreviewFixtures}>
            {(fixture) => (
              <div class="flex flex-row flex-nowrap content-center">
                <BlueBulletPoint />
                <A class="break-all no-underline hover:underline" href={`/demo/emails/${fixture.id}`}>
                  {messageTranslate(fixture.titleKey)}
                </A>
              </div>
            )}
          </For>
        </div>
      </section>
    </div>
  )
}
