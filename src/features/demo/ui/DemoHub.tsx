import { PageWrapper } from "#ui/static/page/PageWrapper.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { DemoCard } from "./DemoCard.js"

export function DemoHub() {
  return (
    <PageWrapper innerClass="py-12 sm:py-16">
      <div class="mx-auto max-w-4xl">
        <h1 class="text-4xl font-semibold tracking-tight">{messageTranslate("app.name")}</h1>
        <p class="mt-3 text-lg text-muted-foreground">{messageTranslate("demo.hub.description")}</p>
        <div class="mt-8 grid gap-6 md:grid-cols-2">
          <DemoCard
            title={messageTranslate("admin.navigation.label")}
            description={messageTranslate("demo.hub.adminDescription")}
            href="/demo/admin"
            linkLabel={messageTranslate("demo.hub.adminOpen")}
          />
          <DemoCard
            title={messageTranslate("email.directory.title")}
            description={messageTranslate("email.hub.description")}
            href="/demo/emails"
            linkLabel={messageTranslate("email.hub.open")}
          />
          <DemoCard
            title={messageTranslate("demo.nav.account")}
            description={messageTranslate("demo.hub.accountDescription")}
            href="/demo/account"
            linkLabel={messageTranslate("demo.hub.accountOpen")}
          />
          <DemoCard
            title={messageTranslate("demo.nav.login")}
            description={messageTranslate("demo.hub.loginDescription")}
            href="/demo/login"
            linkLabel={messageTranslate("demo.hub.loginOpen")}
          />
        </div>
      </div>
    </PageWrapper>
  )
}
