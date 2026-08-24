declare module "qrcode-generator" {
  type QrCode = {
    readonly addData: (data: string, mode?: string) => void
    readonly getModuleCount: () => number
    readonly isDark: (row: number, column: number) => boolean
    readonly make: () => void
  }

  const qrcode: (typeNumber: number, errorCorrectionLevel: string) => QrCode
  export default qrcode
}
