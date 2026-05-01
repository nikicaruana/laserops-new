/**
 * ComingSoon — minimal placeholder used by dashboard pages that aren't built yet.
 *
 * Visual: a centered block with brand chrome. Doesn't pretend to be a dashboard.
 */
type ComingSoonProps = {
  /** What's coming — e.g. "Player Summary" */
  feature: string;
  /** Optional one-liner hinting at scope */
  hint?: string;
};

export function ComingSoon({ feature, hint }: ComingSoonProps) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center border border-border bg-bg-elevated px-6 py-16 text-center">
      <div className="flex items-center gap-2">
        <span aria-hidden className="block h-px w-8 bg-accent" />
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-accent">
          Incoming
        </span>
        <span aria-hidden className="block h-px w-8 bg-accent" />
      </div>
      <h2 className="mt-4 text-2xl font-extrabold sm:text-3xl">
        {feature}
      </h2>
      {hint && (
        <p className="mt-3 max-w-md text-sm text-text-muted">{hint}</p>
      )}
      <p className="mt-6 text-[0.7rem] uppercase tracking-[0.18em] text-text-subtle">
        Coming soon
      </p>
    </div>
  );
}
