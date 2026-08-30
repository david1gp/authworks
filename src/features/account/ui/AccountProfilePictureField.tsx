import { mdiAccountCircleOutline } from "@adaptive-ds/mdi/mdiAccountCircleOutline.js"
import { mdiCloudUploadOutline } from "@adaptive-ds/mdi/mdiCloudUploadOutline.js"
import { Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { authenticatedDangerOutlineButtonClass } from "../../../ui/authenticated/authenticatedDangerOutlineButtonClass.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { userPictureConstraints } from "../../users/public/userPictureConstraints.js"
import type { AccountPictureViewStatus } from "./accountPictureViewStatus.js"
import { accountProfilePictureFieldStateCreate } from "./accountProfilePictureFieldStateCreate.js"

const accountPictureAcceptAttribute = userPictureConstraints.contentTypes.join(",")

export function AccountProfilePictureField(props: {
  readonly errorMessage?: string
  readonly onRemove: () => void
  readonly onUpload: (file: File) => void
  readonly status: AccountPictureViewStatus
  readonly url: string
}) {
  const state = accountProfilePictureFieldStateCreate({
    onRemove: props.onRemove,
    onUpload: props.onUpload,
    status: () => props.status,
    url: () => props.url,
  })

  return (
    <div class="grid min-w-0 gap-3">
      <Show when={props.status === "uploading"}>
        <span class="text-xs text-muted-foreground" role="status">
          {messageTranslate("account.profile.pictureUploading")}
        </span>
      </Show>
      <Show when={props.status === "removing"}>
        <span class="text-xs text-muted-foreground" role="status">
          {messageTranslate("account.profile.pictureRemoving")}
        </span>
      </Show>

      {/* The single native file input stays visually hidden, untabbable, and hidden from the
          accessibility tree so it is not exposed as a second picker button; the dropzone below is
          the one accessible, keyboard-operable upload target that opens it programmatically. */}
      <input
        accept={accountPictureAcceptAttribute}
        aria-hidden="true"
        class="sr-only"
        disabled={state.busy()}
        onChange={state.onFileInputChange}
        ref={state.fileInputSet}
        tabIndex={-1}
        type="file"
      />

      {/* biome-ignore lint/a11y/useSemanticElements: custom dropzone surface combines drag-and-drop target and picker trigger */}
      <div
        aria-disabled={state.busy()}
        aria-label={
          state.hasPicture()
            ? messageTranslate("account.profile.pictureChange")
            : messageTranslate("account.profile.pictureChoose")
        }
        class={`group relative flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-panel border-2 border-dashed p-4 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          state.isDragging()
            ? "border-primary bg-primary/5"
            : "border-line bg-surface hover:border-foreground/30 hover:bg-surface-hover/50"
        } ${state.busy() ? "pointer-events-none opacity-60" : ""}`}
        onClick={state.openFilePicker}
        onDragEnter={state.onDragEnter}
        onDragLeave={state.onDragLeave}
        onDragOver={state.onDragOver}
        onDrop={state.onDrop}
        onKeyDown={state.onKeyDown}
        role="button"
        tabIndex={state.busy() ? -1 : 0}
      >
        <Show
          fallback={
            <div class="flex flex-col items-center gap-2">
              <div class="grid size-16 place-items-center rounded-full border border-dashed border-line bg-muted text-muted-foreground group-hover:text-foreground">
                <Icon class="size-8" path={mdiCloudUploadOutline} />
              </div>
              <div class="grid gap-0.5">
                <p class="text-xs font-medium text-foreground">{messageTranslate("account.profile.pictureChoose")}</p>
                <p class="text-2xs text-muted-foreground">{messageTranslate("account.profile.pictureDropHint")}</p>
              </div>
            </div>
          }
          when={state.hasPicture()}
        >
          <div class="flex flex-col items-center gap-2">
            <div class="relative size-20 overflow-hidden rounded-full border-2 border-line bg-muted shadow-xs">
              <Show
                fallback={
                  <span
                    aria-label={messageTranslate("account.profile.pictureUnavailable")}
                    class="grid size-full place-items-center text-muted-foreground"
                    role="img"
                  >
                    <Icon class="size-10" path={mdiAccountCircleOutline} />
                  </span>
                }
                when={!state.pictureFailed()}
              >
                <img
                  alt={messageTranslate("account.profile.pictureAlt")}
                  class="size-full object-cover"
                  onError={state.onPictureError}
                  src={props.url}
                />
              </Show>
            </div>
            <div class="grid gap-0.5">
              <p class="text-xs font-medium text-foreground">{messageTranslate("account.profile.pictureChange")}</p>
              <p class="text-2xs text-muted-foreground">{messageTranslate("account.profile.pictureDropHint")}</p>
            </div>
          </div>
        </Show>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-2xs text-muted-foreground">{messageTranslate("account.profile.pictureHint")}</p>
        <Show when={props.url.length > 0}>
          <Button
            class={authenticatedDangerOutlineButtonClass}
            disabled={state.busy()}
            onClick={props.onRemove}
            size="sm"
            type="button"
            variant="outline"
          >
            {messageTranslate("account.profile.pictureRemove")}
          </Button>
        </Show>
      </div>

      <Show when={props.errorMessage}>{(message) => <AuthenticatedNotice message={message()} tone="danger" />}</Show>
      <Show when={props.status === "success"}>
        <AuthenticatedNotice message={messageTranslate("account.profile.pictureSaved")} />
      </Show>
    </div>
  )
}
