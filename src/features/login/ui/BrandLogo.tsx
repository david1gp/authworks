export function BrandLogo(props: { readonly name: string }) {
  return (
    <svg class="login-brand-logo text-[var(--brand-primary)]" viewBox="0 0 56 56" role="img" aria-label={props.name}>
      <title>{props.name}</title>
      <rect width="56" height="56" rx="17" fill="currentColor" />
      <text x="28" y="36" fill="var(--brand-background)" font-size="25" font-weight="700" text-anchor="middle">
        {props.name.slice(0, 1)}
      </text>
    </svg>
  )
}
