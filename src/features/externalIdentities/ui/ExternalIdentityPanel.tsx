import { ExternalIdentityIcon } from "./ExternalIdentityIcon.js"
import { Button } from "#ui/interactive/button/Button.jsx"

type ExternalIdentityPanelProps = {
  failed: boolean
  onBack: () => void
  onContinue: () => void
}

export function ExternalIdentityPanel(props: ExternalIdentityPanelProps) {
  return (
    <section>
      <div class="flex items-center gap-3">
        <ExternalIdentityIcon type="google" />
        <h1 class="text-2xl font-semibold">Continue with Google</h1>
      </div>
      <p class="mt-3 text-muted-foreground">You’ll be redirected to Google to authenticate.</p>
      {props.failed && (
        <p class="mt-4 text-sm text-danger" role="alert">
          Google sign-in could not be completed. Try again or choose another method.
        </p>
      )}
      <Button class="mt-6 w-full" variant="filledBlue" onClick={props.onContinue}>
        Continue with Google
      </Button>
      <Button class="mt-3 w-full" variant="link" onClick={props.onBack}>
        Back to methods
      </Button>
    </section>
  )
}
