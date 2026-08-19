import { PageWrapper } from "#ui/static/page/PageWrapper.jsx"
import { DemoCard } from "./DemoCard.js"

export function DemoHub() {
  return (
    <PageWrapper innerClass="py-12 sm:py-16">
      <div class="mx-auto max-w-4xl">
        <h1 class="text-4xl font-semibold tracking-tight">Authworks</h1>
        <p class="mt-3 text-lg text-muted-foreground">Explore the administration and login demos.</p>
        <div class="mt-8 grid gap-6 md:grid-cols-2">
          <DemoCard
            title="Administration"
            description="Manage identity resources and organization settings."
            href="/demo/admin"
            linkLabel="Open administration"
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
