import { type Accessor, createEffect, onCleanup } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { authenticatedImageFallbackStateCreate } from "../../../ui/authenticated/authenticatedImageFallbackStateCreate.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { userPictureConstraints } from "../../users/public/userPictureConstraints.js"
import type { AccountPictureViewStatus } from "./accountPictureViewStatus.js"

export function accountProfilePictureFieldStateCreate(options: {
  readonly onRemove: () => void
  readonly onUpload: (file: File) => void
  readonly status: Accessor<AccountPictureViewStatus>
  readonly url: Accessor<string>
}) {
  const open = createSignalObject(false)
  const isDragging = createSignalObject(false)
  const selectedFile = createSignalObject<File | undefined>(undefined)
  const previewUrl = createSignalObject("")
  const validationMessage = createSignalObject<string | undefined>(undefined)
  const picture = authenticatedImageFallbackStateCreate(() => previewUrl.get() || options.url())
  let fileInput: HTMLInputElement | undefined
  let previousStatus: AccountPictureViewStatus = options.status()
  const busy = () => options.status() === "uploading" || options.status() === "removing"
  const hasPicture = () => (previewUrl.get() || options.url()).length > 0
  const previewClear = () => {
    if (previewUrl.get()) URL.revokeObjectURL(previewUrl.get())
    previewUrl.set("")
    selectedFile.set(undefined)
    validationMessage.set(undefined)
    isDragging.set(false)
  }
  const openChange = (next: boolean) => {
    if (busy() && !next) return
    if (!next) previewClear()
    open.set(next)
  }
  const selectFile = (file: File) => {
    if (busy()) return
    if (!(userPictureConstraints.contentTypes as readonly string[]).includes(file.type)) {
      validationMessage.set(messageTranslate("account.profile.pictureTypeInvalid"))
      return
    }
    if (file.size === 0 || file.size > userPictureConstraints.maximumBytes) {
      validationMessage.set(messageTranslate("account.profile.pictureTooLarge"))
      return
    }
    previewClear()
    selectedFile.set(file)
    previewUrl.set(URL.createObjectURL(file))
  }
  const save = () => {
    const file = selectedFile.get()
    if (file === undefined || busy()) return
    options.onUpload(file)
  }
  createEffect(() => {
    const current = options.status()
    if ((previousStatus === "uploading" || previousStatus === "removing") && current === "success") openChange(false)
    previousStatus = current
  })
  onCleanup(previewClear)
  const openFilePicker = () => {
    if (!busy()) fileInput?.click()
  }
  const fileInputSet = (element: HTMLInputElement) => {
    fileInput = element
  }
  const onFileInputChange = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement
    const file = target.files?.[0]
    target.value = ""
    if (file !== undefined) selectFile(file)
  }
  const onDragOver = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (!busy()) isDragging.set(true)
  }
  const onDragEnter = onDragOver
  const onDragLeave = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const currentTarget = event.currentTarget as HTMLElement | null
    const relatedTarget = event.relatedTarget as Node | null
    if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) return
    isDragging.set(false)
  }
  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    isDragging.set(false)
    const file = event.dataTransfer?.files?.[0]
    if (file !== undefined) selectFile(file)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    openFilePicker()
  }
  return {
    busy,
    fileInputSet,
    hasPicture,
    isDragging: isDragging.get,
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDrop,
    onFileInputChange,
    onKeyDown,
    onPictureError: picture.onError,
    open: open.get,
    openChange,
    openFilePicker,
    pictureFailed: picture.failed,
    previewUrl: () => previewUrl.get() || options.url(),
    save,
    selectedFile: selectedFile.get,
    validationMessage: validationMessage.get,
  }
}
