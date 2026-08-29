import { describe, expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { accountProfilePictureFieldStateCreate } from "../../src/features/account/ui/accountProfilePictureFieldStateCreate.js"

describe("account profile picture field state", () => {
  test("initializes with empty picture state when URL is empty", () => {
    createRoot((dispose) => {
      const state = accountProfilePictureFieldStateCreate({
        onRemove: () => undefined,
        onUpload: () => undefined,
        status: () => "idle",
        url: () => "",
      })

      expect(state.hasPicture()).toBe(false)
      expect(state.isDragging()).toBe(false)
      expect(state.busy()).toBe(false)
      dispose()
    })
  })

  test("reports picture preview when a non-empty URL is provided and preserves picture status upon load failure", () => {
    createRoot((dispose) => {
      let url = "https://assets.example.com/avatar.png"
      const state = accountProfilePictureFieldStateCreate({
        onRemove: () => undefined,
        onUpload: () => undefined,
        status: () => "idle",
        url: () => url,
      })

      expect(state.hasPicture()).toBe(true)
      expect(state.pictureFailed()).toBe(false)

      // When image fails to load, pictureFailed becomes true while hasPicture remains true
      state.onPictureError()
      expect(state.hasPicture()).toBe(true)
      expect(state.pictureFailed()).toBe(true)

      // When URL changes, preview state recovers
      url = "https://assets.example.com/avatar-new.png"
      expect(state.hasPicture()).toBe(true)
      expect(state.pictureFailed()).toBe(false)
      dispose()
    })
  })

  test("permits file replacement and picker activation when picture has failed to load", () => {
    createRoot((dispose) => {
      let uploadedFile: File | undefined
      let clicked = false
      const input = {
        click: () => {
          clicked = true
        },
      } as unknown as HTMLInputElement

      const state = accountProfilePictureFieldStateCreate({
        onRemove: () => undefined,
        onUpload: (file) => {
          uploadedFile = file
        },
        status: () => "idle",
        url: () => "https://assets.example.com/broken-avatar.png",
      })
      state.fileInputSet(input)

      // Simulate image failing to load
      state.onPictureError()
      expect(state.hasPicture()).toBe(true)
      expect(state.pictureFailed()).toBe(true)

      // File picker can still be opened via method and keyboard
      state.openFilePicker()
      expect(clicked).toBe(true)

      clicked = false
      state.onKeyDown({
        key: "Enter",
        preventDefault: () => undefined,
      } as KeyboardEvent)
      expect(clicked).toBe(true)

      // Dropping a replacement file works even when picture load failed
      const file = new File(["new avatar content"], "replacement.png", { type: "image/png" })
      const dropEvent = {
        dataTransfer: { files: [file] },
        preventDefault: () => undefined,
        stopPropagation: () => undefined,
      } as unknown as DragEvent

      state.onDrop(dropEvent)
      expect(uploadedFile).toBe(file)
      dispose()
    })
  })

  test("manages drag state transitions and ignores drag leave within child elements", () => {
    createRoot((dispose) => {
      const state = accountProfilePictureFieldStateCreate({
        onRemove: () => undefined,
        onUpload: () => undefined,
        status: () => "idle",
        url: () => "",
      })

      let prevented = false
      let stopped = false
      const dragEvent = {
        preventDefault: () => {
          prevented = true
        },
        stopPropagation: () => {
          stopped = true
        },
      } as unknown as DragEvent

      state.onDragEnter(dragEvent)
      expect(state.isDragging()).toBe(true)
      expect(prevented).toBe(true)
      expect(stopped).toBe(true)

      state.onDragOver(dragEvent)
      expect(state.isDragging()).toBe(true)

      // Drag leave with relatedTarget inside currentTarget should not clear dragging
      const child = { id: "child" } as unknown as Node
      const parent = {
        contains: (target: Node | null) => target === child,
      } as unknown as HTMLElement

      state.onDragLeave({
        currentTarget: parent,
        preventDefault: () => undefined,
        relatedTarget: child,
        stopPropagation: () => undefined,
      } as unknown as DragEvent)
      expect(state.isDragging()).toBe(true)

      // Drag leave outside should clear dragging
      const outside = { id: "outside" } as unknown as Node
      state.onDragLeave({
        currentTarget: parent,
        preventDefault: () => undefined,
        relatedTarget: outside,
        stopPropagation: () => undefined,
      } as unknown as DragEvent)
      expect(state.isDragging()).toBe(false)
      dispose()
    })
  })

  test("handles drop and triggers upload with dropped file", () => {
    createRoot((dispose) => {
      let uploadedFile: File | undefined
      const state = accountProfilePictureFieldStateCreate({
        onRemove: () => undefined,
        onUpload: (file) => {
          uploadedFile = file
        },
        status: () => "idle",
        url: () => "",
      })

      const file = new File(["test image content"], "avatar.png", { type: "image/png" })
      const dropEvent = {
        dataTransfer: { files: [file] },
        preventDefault: () => undefined,
        stopPropagation: () => undefined,
      } as unknown as DragEvent

      state.onDrop(dropEvent)
      expect(state.isDragging()).toBe(false)
      expect(uploadedFile).toBe(file)
      dispose()
    })
  })

  test("handles file input change and triggers upload", () => {
    createRoot((dispose) => {
      let uploadedFile: File | undefined
      const state = accountProfilePictureFieldStateCreate({
        onRemove: () => undefined,
        onUpload: (file) => {
          uploadedFile = file
        },
        status: () => "idle",
        url: () => "",
      })

      const file = new File(["content"], "profile.webp", { type: "image/webp" })
      const input = {
        files: [file],
        value: "profile.webp",
      } as unknown as HTMLInputElement

      state.onFileInputChange({ currentTarget: input } as unknown as Event)
      expect(uploadedFile).toBe(file)
      expect(input.value).toBe("")
      dispose()
    })
  })

  test("triggers file picker on click and keyboard activation", () => {
    createRoot((dispose) => {
      let clicked = false
      const input = {
        click: () => {
          clicked = true
        },
      } as unknown as HTMLInputElement

      const state = accountProfilePictureFieldStateCreate({
        onRemove: () => undefined,
        onUpload: () => undefined,
        status: () => "idle",
        url: () => "",
      })
      state.fileInputSet(input)

      state.openFilePicker()
      expect(clicked).toBe(true)

      clicked = false
      let defaultPrevented = false
      state.onKeyDown({
        key: "Enter",
        preventDefault: () => {
          defaultPrevented = true
        },
      } as KeyboardEvent)
      expect(defaultPrevented).toBe(true)
      expect(clicked).toBe(true)

      clicked = false
      defaultPrevented = false
      state.onKeyDown({
        key: " ",
        preventDefault: () => {
          defaultPrevented = true
        },
      } as KeyboardEvent)
      expect(defaultPrevented).toBe(true)
      expect(clicked).toBe(true)
      dispose()
    })
  })

  test("blocks file picker, upload, and drag operations when busy", () => {
    createRoot((dispose) => {
      let uploaded = false
      let clicked = false
      let status: "idle" | "uploading" | "removing" = "uploading"
      const input = {
        click: () => {
          clicked = true
        },
      } as unknown as HTMLInputElement

      const state = accountProfilePictureFieldStateCreate({
        onRemove: () => undefined,
        onUpload: () => {
          uploaded = true
        },
        status: () => status,
        url: () => "",
      })
      state.fileInputSet(input)

      expect(state.busy()).toBe(true)

      state.openFilePicker()
      expect(clicked).toBe(false)

      const file = new File(["data"], "photo.jpg", { type: "image/jpeg" })
      state.onDrop({
        dataTransfer: { files: [file] },
        preventDefault: () => undefined,
        stopPropagation: () => undefined,
      } as unknown as DragEvent)
      expect(uploaded).toBe(false)

      status = "removing"
      expect(state.busy()).toBe(true)
      state.openFilePicker()
      expect(clicked).toBe(false)
      dispose()
    })
  })
})
