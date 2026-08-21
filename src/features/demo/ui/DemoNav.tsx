import { Button } from "#ui/interactive/button/Button.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"

type DemoNavProps = {
  compact: boolean
  onNavigate: (path: string) => void
  onToggle: () => void
}

export function DemoNav(props: DemoNavProps) {
  return (
    <aside class={`w-full shrink-0 ${props.compact ? "lg:w-16" : "lg:w-56"}`}>
      <div class="flex flex-wrap gap-2 rounded-xl border border-line bg-surface p-2 lg:sticky lg:top-4 lg:grid lg:p-3">
        {!props.compact && (
          <p class="hidden px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:block">
            {messageTranslate("demo.nav.label")}
          </p>
        )}
        <Button variant="ghost" class="justify-start" onClick={() => props.onNavigate("/demo")}>
          {props.compact ? "⌂" : messageTranslate("demo.nav.hub")}
        </Button>
        <Button variant="ghost" class="justify-start" onClick={() => props.onNavigate("/demo/login")}>
          {props.compact ? "↪" : messageTranslate("demo.nav.login")}
        </Button>
        <Button variant="ghost" class="justify-start" onClick={() => props.onNavigate("/demo/account")}>
          {props.compact ? "◎" : messageTranslate("demo.nav.account")}
        </Button>
        <Button variant="ghost" class="justify-start" onClick={() => props.onNavigate("/demo/admin")}>
          {props.compact ? "⚙" : messageTranslate("demo.nav.admin")}
        </Button>
        <Button variant="ghost" class="justify-start" onClick={() => props.onNavigate("/demo/emails")}>
          {props.compact ? "✉" : messageTranslate("demo.nav.emails")}
        </Button>
        <Button variant="ghost" class="hidden justify-start lg:inline-flex" onClick={props.onToggle}>
          {props.compact ? "→" : messageTranslate("demo.nav.compact")}
        </Button>
      </div>
    </aside>
  )
}
