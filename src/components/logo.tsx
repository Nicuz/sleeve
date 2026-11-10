export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="10 10 80 80" className={className} aria-hidden="true" fill="none">
      <g
        transform="rotate(-6 50 50)"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle
          cx="50"
          cy="50"
          r="32"
          strokeWidth="7.5"
          strokeDasharray="128 28"
          strokeDashoffset="18"
        />
        <circle
          cx="50"
          cy="50"
          r="21"
          strokeWidth="6"
          strokeDasharray="78 24"
          strokeDashoffset="-10"
        />
        <circle
          cx="50"
          cy="50"
          r="11"
          strokeWidth="5"
          strokeDasharray="36 14"
          strokeDashoffset="8"
        />
      </g>
      <circle cx="50" cy="50" r="4" fill="var(--color-accent, #f4b860)" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark className="h-9 w-9 shrink-0 text-cream" />
      {!compact && (
        <div className="leading-none">
          <span className="font-display text-xl font-semibold tracking-tight text-cream">
            sleeve
          </span>
          <span className="mt-1 block text-[8px] font-semibold tracking-[0.26em] text-muted/70 uppercase">
            dust-free shelf
          </span>
        </div>
      )}
    </div>
  );
}
