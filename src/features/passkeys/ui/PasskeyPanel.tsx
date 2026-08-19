import { Button } from "#ui/interactive/button/Button.jsx"

type PasskeyPanelProps = {
  unsupported: boolean
  onBack: () => void
  onComplete: () => void
}

export function PasskeyPanel(props: PasskeyPanelProps) {
  return (
    <section>
      <h1 class="text-2xl font-semibold">Sign in with a passkey</h1>
      {props.unsupported ? (
        <p class="mt-3 text-muted-foreground">
          This browser or device does not support passkeys. Choose another sign-in method.
        </p>
      ) : (
        <>
          <p class="mt-3 text-muted-foreground">Use your device’s screen lock or security key.</p>
          <Button class="mt-6 w-full" variant="filledBlue" onClick={props.onComplete}>
            Use passkey
          </Button>
        </>
      )}
      <Button class="mt-3 w-full" variant="link" onClick={props.onBack}>
        Back to methods
      </Button>
    </section>
  )
}
