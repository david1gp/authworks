import { Button } from "#ui/interactive/button/Button.jsx"

type DemoNavProps = {
  compact: boolean
  onNavigate: (path: string) => void
  onToggle: () => void
}

export function DemoNav(props: DemoNavProps) {
  return (
    <aside class={props.compact ? "w-16" : "w-56"}>
      <div class="sticky top-4 grid gap-2 rounded-xl border border-line bg-surface p-3">
        {!props.compact && (
          <p class="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Demo</p>
        )}
        <Button variant="ghost" class="justify-start" onClick={() => props.onNavigate("/demo")}>
          {props.compact ? "⌂" : "Hub"}
        </Button>
        <Button variant="ghost" class="justify-start" onClick={() => props.onNavigate("/demo/login")}>
          {props.compact ? "↪" : "Login"}
        </Button>
        <Button variant="ghost" class="justify-start" onClick={() => props.onNavigate("/demo/admin")}>
          {props.compact ? "⚙" : "Admin"}
        </Button>
        <Button variant="ghost" class="justify-start" onClick={props.onToggle}>
          {props.compact ? "→" : "Compact"}
        </Button>
      </div>
    </aside>
  )
}
