import { Show } from "solid-js"
import { BrandLogo } from "./BrandLogo.js"

type BrandHeaderProps = {
  name: string
  logoUrl?: string
  onLogoError: () => void
}

export function BrandHeader(props: BrandHeaderProps) {
  return (
    <header class="login-card-header">
      <div class="login-brand-identity">
        <Show when={props.logoUrl} fallback={<BrandLogo name={props.name} />}>
          <img class="login-brand-logo" src={props.logoUrl} alt={props.name} onError={props.onLogoError} />
        </Show>
      </div>
      <p class="login-organization-name">{props.name}</p>
    </header>
  )
}
