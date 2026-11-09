export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="accent-glow relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cream text-ink-950">
        <span className="absolute inset-[3px] rounded-full border border-ink-950/20" />
        <span className="absolute inset-[7px] rounded-full border border-ink-950/10" />
        <span className="h-2 w-2 rounded-full bg-accent" />
      </div>
      {!compact && (
        <div className="leading-none">
          <span className="font-display text-xl font-semibold tracking-tight text-cream">
            sleeve
          </span>
          <span className="mt-1 block text-[8px] font-semibold tracking-[0.26em] text-muted/70 uppercase">
            listening archive
          </span>
        </div>
      )}
    </div>
  );
}
