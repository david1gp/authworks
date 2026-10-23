export function authenticatedOptionCardStateCreate(options: {
  readonly disabled: () => boolean
  readonly onSelect?: () => void
}) {
  return {
    select: () => {
      if (!options.disabled()) options.onSelect?.()
    },
  }
}
