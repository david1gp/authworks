/** Complete modal surfaces without vendored palette, radii or shadows. */
export const authenticatedDialogClasses = {
  content:
    "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-h-[95vh] overflow-auto rounded-2xl border border-line bg-surface p-6 text-foreground shadow-overlay data-open:animate-in data-open:fade-in-50% data-open:zoom-in-95% data-closed:animate-out data-closed:fade-out-50% data-closed:zoom-out-95%",
  overlay:
    "fixed inset-0 bg-slate-950/45 backdrop-blur-[2px] data-open:animate-in data-open:fade-in-50% data-closed:animate-out data-closed:fade-out-50%",
}
