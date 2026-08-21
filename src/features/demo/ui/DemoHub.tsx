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
            title="Administration"
            description="Manage identity resources and organization settings."
            href="/demo/admin"
            linkLabel="Open administration"
          />
          <DemoCard
            title={messageTranslate("email.directory.title")}
            description={messageTranslate("email.hub.description")}
            href="/demo/emails"
            linkLabel={messageTranslate("email.hub.open")}
          />
          <DemoCard
            title="Account"
            description="Explore self-service profile, organization, and security destinations."
            href="/demo/account"
            linkLabel="Open account"
          />
          <DemoCard
            title="Login"
            description="Explore the authentication experience for your users."
            href="/demo/login"
            linkLabel="Open login"
          />
        </div>
      </div>
    </PageWrapper>
  )
}
