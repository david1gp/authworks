import { describe, expect, test } from "bun:test"
import { flush, createRoot } from "solid-js"
import { accountProfilePictureFieldStateCreate } from "../../src/features/account/ui/accountProfilePictureFieldStateCreate.js"

describe("account profile picture field state", () => {
  test("rejects invalid files and discards staged selection on cancel", () => {
    createRoot((dispose) => {
      let uploaded = false
      const state = accountProfilePictureFieldStateCreate({
        onRemove: () => undefined,
        onUpload: () => {
          uploaded = true
        },
        status: () => "idle",
        url: () => "https://assets.example.com/current.png",
      })
      const drop = (file: File) =>
        state.onDrop({
          dataTransfer: { files: [file] },
          preventDefault: () => undefined,
          stopPropagation: () => undefined,
        } as unknown as DragEvent)
      return () => {
        flush()
        state.openChange(true)
        flush()
        drop(new File(["bad"], "bad.txt", { type: "text/plain" }))
        flush()
        expect(state.validationMessage()).toBeTruthy()
        expect(state.selectedFile()).toBeUndefined()
        drop(new File([new Uint8Array(512 * 1024 + 1)], "big.png", { type: "image/png" }))
        flush()
        expect(state.validationMessage()).toBeTruthy()
        expect(state.selectedFile()).toBeUndefined()
        drop(new File(["valid"], "good.png", { type: "image/png" }))
        flush()
        expect(state.validationMessage()).toBeUndefined()
        expect(state.selectedFile()?.name).toBe("good.png")
        state.openChange(false)
        flush()
        expect(state.selectedFile()).toBeUndefined()
        expect(state.previewUrl()).toBe("https://assets.example.com/current.png")
        state.save()
        flush()
        expect(uploaded).toBe(false)
        dispose()
      }
    })()
  })
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
      return () => {
        flush()
        state.onPictureError()
        flush()
        expect(state.hasPicture()).toBe(true)
        expect(state.pictureFailed()).toBe(true)

        // When URL changes, preview state recovers
        url = "https://assets.example.com/avatar-new.png"
        flush()
        expect(state.hasPicture()).toBe(true)
        expect(state.pictureFailed()).toBe(false)
        dispose()
      }
    })()
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
      return () => {
        flush()
        state.openChange(true)

        // Simulate image failing to load
        flush()
        state.onPictureError()
        flush()
        expect(state.hasPicture()).toBe(true)
        expect(state.pictureFailed()).toBe(true)

        // File picker can still be opened via method and keyboard
        state.openFilePicker()
        flush()
        expect(clicked).toBe(true)

        clicked = false
        flush()
        state.onKeyDown({
          key: "Enter",
          preventDefault: () => undefined,
        } as KeyboardEvent)
        flush()
        expect(clicked).toBe(true)

        // Dropping a replacement file works even when picture load failed
        const file = new File(["new avatar content"], "replacement.png", { type: "image/png" })
        const dropEvent = {
          dataTransfer: { files: [file] },
          preventDefault: () => undefined,
          stopPropagation: () => undefined,
        } as unknown as DragEvent

        flush()
        state.onDrop(dropEvent)
        flush()
        expect(state.selectedFile()).toBe(file)
        expect(uploadedFile).toBeUndefined()
        state.save()
        flush()
        expect(uploadedFile).toBe(file)
        dispose()
      }
    })()
  })

  test("manages drag state transitions and ignores drag leave within child elements", () => {
    createRoot((dispose) => {
      const state = accountProfilePictureFieldStateCreate({
        onRemove: () => undefined,
        onUpload: () => undefined,
        status: () => "idle",
        url: () => "",
      })
      return () => {
        flush()
        state.openChange(true)

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

        flush()
        state.onDragEnter(dragEvent)
        flush()
        expect(state.isDragging()).toBe(true)
        expect(prevented).toBe(true)
        expect(stopped).toBe(true)

        state.onDragOver(dragEvent)
        flush()
        expect(state.isDragging()).toBe(true)

        // Drag leave with relatedTarget inside currentTarget should not clear dragging
        const child = { id: "child" } as unknown as Node
        const parent = {
          contains: (target: Node | null) => target === child,
        } as unknown as HTMLElement

        flush()
        state.onDragLeave({
          currentTarget: parent,
          preventDefault: () => undefined,
          relatedTarget: child,
          stopPropagation: () => undefined,
        } as unknown as DragEvent)
        flush()
        expect(state.isDragging()).toBe(true)

        // Drag leave outside should clear dragging
        const outside = { id: "outside" } as unknown as Node
        flush()
        state.onDragLeave({
          currentTarget: parent,
          preventDefault: () => undefined,
          relatedTarget: outside,
          stopPropagation: () => undefined,
        } as unknown as DragEvent)
        flush()
        expect(state.isDragging()).toBe(false)
        dispose()
      }
    })()
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
      return () => {
        flush()
        state.openChange(true)

        const file = new File(["test image content"], "avatar.png", { type: "image/png" })
        const dropEvent = {
          dataTransfer: { files: [file] },
          preventDefault: () => undefined,
          stopPropagation: () => undefined,
        } as unknown as DragEvent

        flush()
        state.onDrop(dropEvent)
        flush()
        expect(state.isDragging()).toBe(false)
        expect(state.selectedFile()).toBe(file)
        expect(uploadedFile).toBeUndefined()
        state.save()
        flush()
        expect(uploadedFile).toBe(file)
        dispose()
      }
    })()
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
      return () => {
        flush()
        state.openChange(true)

        const file = new File(["content"], "profile.webp", { type: "image/webp" })
        const input = {
          files: [file],
          value: "profile.webp",
        } as unknown as HTMLInputElement

        flush()
        state.onFileInputChange({ currentTarget: input } as unknown as Event)
        flush()
        expect(state.selectedFile()).toBe(file)
        expect(uploadedFile).toBeUndefined()
        state.save()
        flush()
        expect(uploadedFile).toBe(file)
        expect(input.value).toBe("")
        dispose()
      }
    })()
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
      return () => {
        flush()
        state.openChange(true)
        flush()

        state.openFilePicker()
        flush()
        expect(clicked).toBe(true)

        clicked = false
        let defaultPrevented = false
        flush()
        state.onKeyDown({
          key: "Enter",
          preventDefault: () => {
            defaultPrevented = true
          },
        } as KeyboardEvent)
        flush()
        expect(defaultPrevented).toBe(true)
        expect(clicked).toBe(true)

        clicked = false
        defaultPrevented = false
        flush()
        state.onKeyDown({
          key: " ",
          preventDefault: () => {
            defaultPrevented = true
          },
        } as KeyboardEvent)
        flush()
        expect(defaultPrevented).toBe(true)
        expect(clicked).toBe(true)
        dispose()
      }
    })()
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
      return () => {
        flush()
        state.openChange(true)

        flush()
        expect(state.busy()).toBe(true)

        state.openFilePicker()
        flush()
        expect(clicked).toBe(false)

        const file = new File(["data"], "photo.jpg", { type: "image/jpeg" })
        flush()
        state.onDrop({
          dataTransfer: { files: [file] },
          preventDefault: () => undefined,
          stopPropagation: () => undefined,
        } as unknown as DragEvent)
        flush()
        expect(uploaded).toBe(false)

        status = "removing"
        flush()
        expect(state.busy()).toBe(true)
        state.openFilePicker()
        flush()
        expect(clicked).toBe(false)
        dispose()
      }
    })()
  })

  test("allows upload and removal only while the picture dialog is open", () => {
    createRoot((dispose) => {
      let uploads = 0
      let removals = 0
      const state = accountProfilePictureFieldStateCreate({
        onRemove: () => {
          removals++
        },
        onUpload: () => {
          uploads++
        },
        status: () => "idle",
        url: () => "https://assets.example.com/avatar.png",
      })
      const file = new File(["image"], "avatar.png", { type: "image/png" })
      const drop = () =>
        state.onDrop({
          dataTransfer: { files: [file] },
          preventDefault: () => undefined,
          stopPropagation: () => undefined,
        } as unknown as DragEvent)

      return () => {
        flush()
        drop()
        flush()
        state.save()
        flush()
        state.remove()
        flush()
        expect(state.selectedFile()).toBeUndefined()
        expect(uploads).toBe(0)
        expect(removals).toBe(0)

        state.openChange(true)
        flush()
        drop()
        flush()
        state.save()
        flush()
        state.remove()
        flush()
        expect(uploads).toBe(1)
        expect(removals).toBe(1)

        state.openChange(false)
        flush()
        expect(state.selectedFile()).toBeUndefined()
        state.save()
        flush()
        state.remove()
        flush()
        expect(uploads).toBe(1)
        expect(removals).toBe(1)
        dispose()
      }
    })()
  })
})
