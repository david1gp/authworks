import { mdiGithub, mdiGoogle, mdiMicrosoft } from "@mdi/js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import type { ExternalIdentityProviderType } from "../public/externalIdentityProviderTypeSchema.js"

const providerIcons: Readonly<Record<ExternalIdentityProviderType, string>> = {
  github: mdiGithub,
  google: mdiGoogle,
  microsoft: mdiMicrosoft,
}

export function ExternalIdentityIcon(props: { readonly class?: string; readonly type: ExternalIdentityProviderType }) {
  return <Icon class={props.class} path={providerIcons[props.type]} />
}
