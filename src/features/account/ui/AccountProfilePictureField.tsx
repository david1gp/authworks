import { mdiAccountCircleOutline } from "@adaptive-ds/mdi/mdiAccountCircleOutline.js"
import { Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { authenticatedDangerOutlineButtonClass } from "../../../ui/authenticated/authenticatedDangerOutlineButtonClass.js"
import { authenticatedImageFallbackStateCreate } from "../../../ui/authenticated/authenticatedImageFallbackStateCreate.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { userPictureConstraints } from "../../users/public/userPictureConstraints.js"
import type { AccountPictureViewStatus } from "./accountPictureViewStatus.js"

const accountPictureAcceptAttribute = userPictureConstraints.contentTypes.join(",")

export function AccountProfilePictureField(props: {
  readonly errorMessage?: string
  readonly onRemove: () => void
  readonly onUpload: (file: File) => void
  readonly status: AccountPictureViewStatus
  readonly url: string
}) {
  const busy = () => props.status === "uploading" || props.status === "removing"
  const picture = authenticatedImageFallbackStateCreate(() => props.url)
  return (
    <div class="grid min-w-0 gap-2 rounded-control border border-line-subtle px-2.5 py-2.5">
      <p class="text-2xs font-semibold tracking-[0.12em] uppercase text-muted-foreground">
        {messageTranslate("account.profile.picture")}
      </p>
      <div class="flex flex-wrap items-center gap-2">
        {/* A stored picture URL is hosted by the deployment and may be unreachable, so an image
            that fails to load degrades to the neutral placeholder rather than a broken image. */}
        <Show when={props.url.length > 0}>
          <Show
            fallback={
              <span
                aria-label={messageTranslate("account.profile.pictureUnavailable")}
                class="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-muted text-muted-foreground"
                role="img"
              >
                <Icon class="size-5" path={mdiAccountCircleOutline} />
              </span>
            }
            when={!picture.failed()}
          >
            <img
              alt={messageTranslate("account.profile.pictureAlt")}
              class="size-10 shrink-0 rounded-full border border-line object-cover"
              onError={picture.onError}
              src={props.url}
            />
          </Show>
        </Show>
        {/* The file input stays visually hidden so the label can carry the accessible control name. */}
        <label class="inline-flex h-8 cursor-pointer items-center rounded-control border border-line bg-surface px-2.5 text-xs font-medium transition-colors hover:bg-surface-hover">
          {messageTranslate("account.profile.pictureChoose")}
          <input
            accept={accountPictureAcceptAttribute}
            aria-label={messageTranslate("account.profile.pictureChoose")}
            class="sr-only"
            disabled={busy()}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ""
              if (file !== undefined) props.onUpload(file)
            }}
            type="file"
          />
        </label>
        <Show when={props.url.length > 0}>
          <Button
            class={authenticatedDangerOutlineButtonClass}
            disabled={busy()}
            onClick={props.onRemove}
            size="sm"
            type="button"
            variant="outline"
          >
            {messageTranslate("account.profile.pictureRemove")}
          </Button>
        </Show>
      </div>
      <p class="text-xs text-muted-foreground">{messageTranslate("account.profile.pictureHint")}</p>
      <Show when={props.errorMessage}>{(message) => <AuthenticatedNotice message={message()} tone="danger" />}</Show>
      <Show when={props.status === "uploading"}>
        <p class="text-xs text-muted-foreground" role="status">
          {messageTranslate("account.profile.pictureUploading")}
        </p>
      </Show>
      <Show when={props.status === "success"}>
        <AuthenticatedNotice message={messageTranslate("account.profile.pictureSaved")} />
      </Show>
    </div>
  )
}
