import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ttc } from "../../../ui/i18n/model/ttc.js"
import { DemoFixtureStateSelector } from "../../demo/ui/DemoFixtureStateSelector.js"

type StateOption = { href: string; label: string; selected: boolean }

/** Shared compact fixture header for the account and invitation demo destinations. */
export function AccountDemoFixtureHeader(props: {
  readonly description: string
  readonly stateOptions: readonly StateOption[]
  readonly title: string
}) {
  return (
    <AuthenticatedPageHeader
      description={ttc(props.description)}
      eyebrow={messageTranslate("demo.fixture.preview")}
      meta={
        <>
          <span class="text-2xs font-semibold tracking-[0.12em] uppercase">
            {messageTranslate("demo.fixture.state")}
          </span>
          <DemoFixtureStateSelector options={props.stateOptions} />
        </>
      }
      title={ttc(props.title)}
    />
  )
}
