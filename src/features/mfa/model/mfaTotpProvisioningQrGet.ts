import qrcode from "qrcode-generator"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

const quietZone = 2

export function mfaTotpProvisioningQrGet(provisioningUri: string) {
  const op = "mfaTotpProvisioningQrGet"
  if (!provisioningUri.startsWith("otpauth://totp/"))
    return resultErrorCodedCreate(op, "The authenticator setup code could not be displayed.", "mfa.invalid")
  try {
    const code = qrcode(0, "M")
    code.addData(provisioningUri, "Byte")
    code.make()
    const moduleCount = code.getModuleCount()
    let path = ""
    for (let row = 0; row < moduleCount; row += 1) {
      for (let column = 0; column < moduleCount; column += 1) {
        if (code.isDark(row, column)) path += `M${column + quietZone} ${row + quietZone}h1v1h-1z`
      }
    }
    return resultCreate({
      path,
      viewBoxSize: moduleCount + quietZone * 2,
    })
  } catch {
    return resultErrorCodedCreate(op, "The authenticator setup code could not be displayed.", "mfa.invalid")
  }
}
