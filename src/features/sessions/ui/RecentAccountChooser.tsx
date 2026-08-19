import { For } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"

type RecentAccountChooserProps = {
  onSelect: (identifier: string) => void
}

export function RecentAccountChooser(props: RecentAccountChooserProps) {
  return (
    <section>
      <h1 class="text-2xl font-semibold">Choose an account</h1>
      <p class="mt-2 text-muted-foreground">Continue with a recently used account.</p>
      <div class="mt-6 grid gap-3">
        <For each={["alex@example.com", "sam@example.com"]}>
          {(identifier) => (
            <Button variant="outline" class="w-full justify-start" onClick={() => props.onSelect(identifier)}>
              {identifier}
            </Button>
          )}
        </For>
      </div>
      <Button class="mt-4 w-full" variant="link" onClick={() => props.onSelect("")}>
        Use another account
      </Button>
    </section>
  )
}
