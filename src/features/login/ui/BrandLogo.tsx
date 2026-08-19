type BrandLogoProps = {
  name: string
}

export function BrandLogo(props: BrandLogoProps) {
  return (
    <div
      class="flex size-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white"
      aria-label={props.name}
    >
      {props.name.slice(0, 1)}
    </div>
  )
}
