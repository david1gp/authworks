import { createMemo } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { mfaTotpProvisioningQrGet } from "../model/mfaTotpProvisioningQrGet.js"
import { mfaSecretGroupsGet } from "../model/mfaSecretGroupsGet.js"

export function mfaTotpEnrollPanelStateCreate(secret: () => string | undefined, otpauthUri: () => string | undefined) {
  const secretVisible = createSignalObject(false)
  return {
    qr: createMemo(() => {
      const uri = otpauthUri()
      if (uri === undefined) return undefined
      const rendered = mfaTotpProvisioningQrGet(uri)
      return rendered.success ? rendered.data : undefined
    }),
    secretGroups: createMemo(() => mfaSecretGroupsGet(secret() ?? "")),
    secretVisible: secretVisible.get,
    secretVisibleToggle: () => secretVisible.set(!secretVisible.get()),
  }
}
