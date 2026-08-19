import { Button } from "#ui/interactive/button/Button.jsx"

type UnsupportedMethodPanelProps = {
  title: string
  description: string
  onBack: () => void
}

export function UnsupportedMethodPanel(props: UnsupportedMethodPanelProps) {
  return (
    <section>
      <h1 class="text-2xl font-semibold">{props.title}</h1>
      <p class="mt-3 text-muted-foreground">{props.description}</p>
      <Button class="mt-6 w-full" variant="outline" onClick={props.onBack}>
        Back to methods
      </Button>
    </section>
  )
}
