import { Show } from "solid-js"
import { BrandLogo } from "./BrandLogo.js"

type BrandHeaderProps = {
  name: string
  logoUrl?: string
}

export function BrandHeader(props: BrandHeaderProps) {
  return (
    <header class="mb-6 flex justify-center">
      <Show when={props.logoUrl} fallback={<BrandLogo name={props.name} />}>
        <img class="max-h-14 max-w-52 object-contain" src={props.logoUrl} alt={props.name} />
      </Show>
    </header>
  )
}
