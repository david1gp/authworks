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
    <div class="grid min-w-0 justify-items-center gap-2 sm:justify-items-start">
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
        class={`group relative grid size-28 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border-2 text-center shadow-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
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
            <div class="grid size-full place-items-center bg-muted text-muted-foreground group-hover:text-foreground">
              <Icon class="size-10" path={mdiCloudUploadOutline} />
            </div>
          }
          when={state.hasPicture()}
        >
          <div class="size-full">
            <div class="relative size-full overflow-hidden bg-muted">
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
          </div>
        </Show>
        <span class="absolute inset-x-0 bottom-0 bg-foreground/75 px-1 py-1 text-2xs font-medium text-background">
          {state.hasPicture()
            ? messageTranslate("account.profile.pictureChange")
            : messageTranslate("account.profile.pictureChoose")}
        </span>
      </div>

      <div class="flex max-w-48 flex-wrap items-center justify-center gap-2 sm:justify-start">
        <p class="text-center text-2xs text-muted-foreground sm:text-left">
          {messageTranslate("account.profile.pictureHint")}
        </p>
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
