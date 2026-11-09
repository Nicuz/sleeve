import { Disc3, Plus } from 'lucide-react';
import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="relative mb-6 grid h-28 w-28 place-items-center">
        <span className="absolute inset-0 rounded-full border border-white/[0.06]" />
        <span className="absolute inset-3 rounded-full border border-white/[0.08]" />
        <span className="absolute inset-6 rounded-full border border-white/10" />
        <span className="absolute inset-9 rounded-full border border-white/10" />
        <span className="grid h-10 w-10 place-items-center rounded-full bg-accent/15 text-accent">
          {icon ?? <Disc3 size={20} />}
        </span>
      </div>
      <h3 className="font-display text-xl font-semibold text-cream">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{description}</p>
      {actionLabel && onAction && (
        <button type="button" onClick={() => onAction()} className="btn btn-primary mt-6">
          <Plus size={16} />
          {actionLabel}
        </button>
      )}
    </div>
  );
}
