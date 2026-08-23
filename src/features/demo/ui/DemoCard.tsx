import { LinkButtonExternal } from "#ui/interactive/link/LinkButton.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"

type DemoCardProps = {
  title: () => string
  description: () => string
  href: string
  linkLabel: () => string
}

export function DemoCard(p: DemoCardProps) {
  return (
    <CardWrapper class="flex flex-col gap-4">
      <div>
        <h2 class="text-2xl font-semibold">{p.title()}</h2>
        <p class="mt-2 text-muted-foreground">{p.description()}</p>
      </div>
      <div>
        <LinkButtonExternal href={p.href} variant="filledBlue">
          {p.linkLabel()}
        </LinkButtonExternal>
      </div>
    </CardWrapper>
  )
}
