import { type Accessor } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { authenticatedImageFallbackStateCreate } from "../../../ui/authenticated/authenticatedImageFallbackStateCreate.js"
import type { AccountPictureViewStatus } from "./accountPictureViewStatus.js"

export function accountProfilePictureFieldStateCreate(options: {
  readonly onRemove: () => void
  readonly onUpload: (file: File) => void
  readonly status: Accessor<AccountPictureViewStatus>
  readonly url: Accessor<string>
}) {
  const isDragging = createSignalObject(false)
  const picture = authenticatedImageFallbackStateCreate(options.url)
  let fileInput: HTMLInputElement | undefined

  const busy = () => options.status() === "uploading" || options.status() === "removing"
  const hasPicture = () => options.url().length > 0

  const openFilePicker = () => {
    if (busy()) return
    fileInput?.click()
  }

  const fileInputSet = (element: HTMLInputElement) => {
    fileInput = element
  }

  const onFileInputChange = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement
    const file = target.files?.[0]
    target.value = ""
    if (file !== undefined && !busy()) options.onUpload(file)
  }

  const onDragOver = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (busy()) return
    if (!isDragging.get()) isDragging.set(true)
  }

  const onDragEnter = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (busy()) return
    isDragging.set(true)
  }

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
    if (busy()) return
    const file = event.dataTransfer?.files?.[0]
    if (file !== undefined) options.onUpload(file)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      openFilePicker()
    }
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
    openFilePicker,
    pictureFailed: picture.failed,
  }
}
