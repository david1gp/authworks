import { mdiAccountCircleOutline } from "@adaptive-ds/mdi/mdiAccountCircleOutline.js"
import { mdiCloudUploadOutline } from "@adaptive-ds/mdi/mdiCloudUploadOutline.js"
import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiDelete } from "@adaptive-ds/mdi/mdiDelete.js"
import { Show } from "solid-js"
import { ButtonIcon } from "#ui/interactive/button/ButtonIcon.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
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
    <div class="grid justify-items-center gap-2 sm:justify-items-start">
      <AuthenticatedDialog
        class="!size-28 !rounded-full !p-0 overflow-hidden"
        onOpenChange={state.openChange}
        open={state.open()}
        title={messageTranslate("account.profile.picture")}
        triggerLabel={
          <>
            <span class="sr-only">{messageTranslate("account.profile.pictureChange")}</span>
            <Show
              fallback={<Icon class="size-14 text-muted-foreground" path={mdiAccountCircleOutline} />}
              when={props.url && !state.pictureFailed()}
            >
              <img alt="" class="size-full object-cover" onError={state.onPictureError} src={props.url} />
            </Show>
          </>
        }
        variant="outline"
      >
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
        <div class="grid justify-items-center gap-3">
          <div class="grid size-28 place-items-center overflow-hidden rounded-full border border-line bg-muted">
            <Show
              fallback={<Icon class="size-12 text-muted-foreground" path={mdiAccountCircleOutline} />}
              when={state.hasPicture() && !state.pictureFailed()}
            >
              <img
                alt={messageTranslate("account.profile.picturePreview")}
                class="size-full object-cover"
                onError={state.onPictureError}
                src={state.previewUrl()}
              />
            </Show>
          </div>
          {/* biome-ignore lint/a11y/useSemanticElements: the drag target also opens the native file picker */}
          <div
            aria-disabled={state.busy()}
            aria-label={messageTranslate("account.profile.pictureChoose")}
            class={`grid w-full cursor-pointer justify-items-center gap-2 rounded-panel border-2 border-dashed p-5 text-center focus-visible:ring-2 focus-visible:ring-primary ${state.isDragging() ? "border-primary bg-primary/5" : "border-line"}`}
            onClick={state.openFilePicker}
            onDragEnter={state.onDragEnter}
            onDragLeave={state.onDragLeave}
            onDragOver={state.onDragOver}
            onDrop={state.onDrop}
            onKeyDown={state.onKeyDown}
            role="button"
            tabIndex={state.busy() ? -1 : 0}
          >
            <Icon class="size-8 text-muted-foreground" path={mdiCloudUploadOutline} />
            <span class="text-sm">{messageTranslate("account.profile.pictureDropHint")}</span>
            <span class="rounded-panel border border-line px-3 py-1 text-sm">
              {messageTranslate("account.profile.pictureChoose")}
            </span>
          </div>
          <p class="text-xs text-muted-foreground">{messageTranslate("account.profile.pictureHint")}</p>
          <Show when={state.selectedFile()}>{(file) => <p class="break-all text-sm">{file().name}</p>}</Show>
          <Show when={state.validationMessage()}>
            {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
          </Show>
          <Show when={props.errorMessage}>
            {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
          </Show>
          <Show when={state.busy()}>
            <span role="status" class="text-sm text-muted-foreground">
              {messageTranslate(
                props.status === "removing" ? "account.profile.pictureRemoving" : "account.profile.pictureUploading",
              )}
            </span>
          </Show>
          <div class="flex flex-wrap justify-center gap-2">
            <ButtonIcon
              disabled={state.busy() || !state.selectedFile()}
              icon={mdiContentSave}
              onClick={state.save}
              type="button"
            >
              {messageTranslate("account.profile.save")}
            </ButtonIcon>
            <ButtonIcon disabled={state.busy()} onClick={() => state.openChange(false)} type="button" variant="outline">
              {messageTranslate("account.profile.cancel")}
            </ButtonIcon>
            <Show when={props.url.length > 0}>
              <ButtonIcon
                class={authenticatedDangerOutlineButtonClass}
                disabled={state.busy()}
                icon={mdiDelete}
                onClick={props.onRemove}
                type="button"
                variant="outline"
              >
                {messageTranslate("account.profile.pictureRemove")}
              </ButtonIcon>
            </Show>
          </div>
        </div>
      </AuthenticatedDialog>
      <Show when={props.status === "success"}>
        <AuthenticatedNotice message={messageTranslate("account.profile.pictureSaved")} />
      </Show>
    </div>
  )
}
