import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: ReadonlyArray<SegmentedOption<T>>;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'grid w-full gap-1 rounded-xl border border-white/10 bg-ink-900/60 p-1 sm:w-48',
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition',
              selected ? 'bg-white/10 text-cream' : 'text-muted hover:text-cream',
            )}
          >
            {Icon ? <Icon size={13} /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
