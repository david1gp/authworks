import { mdiAccount } from "@mdi/js"
import { Icon } from "#ui/static/icon/Icon.jsx"

type ExternalIdentityIconProps = {
  type: "google" | "github" | "microsoft"
}

export function ExternalIdentityIcon(props: ExternalIdentityIconProps) {
  return <Icon path={mdiAccount} title={`${props.type} identity provider`} />
}
