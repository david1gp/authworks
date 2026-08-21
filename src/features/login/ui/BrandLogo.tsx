export function BrandLogo(props: { readonly name: string }) {
  return (
    <div
      class="flex size-14 items-center justify-center rounded-2xl bg-accent text-2xl font-bold text-accent-contrast"
      role="img"
      aria-label={props.name}
    >
      <span aria-hidden="true">{props.name.slice(0, 1)}</span>
    </div>
  )
}
