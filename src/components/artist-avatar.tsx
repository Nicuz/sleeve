import { cn, hueFromString } from '@/lib/utils';

export function ArtistAvatar({ name, className }: { name: string; className?: string }) {
  const hue = hueFromString(name);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return (
    <div
      role="img"
      aria-label={name}
      className={cn(
        'grid shrink-0 place-items-center rounded-full border border-white/10 font-display font-semibold text-cream  ',
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(140deg, hsl(${hue} 32% 25%), hsl(${(hue + 55) % 360} 42% 10%))`,
      }}
    >
      <span className="drop-shadow-sm">{initials}</span>
    </div>
  );
}
