import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  ChevronDown,
  Disc3,
  Info,
  MapPin,
  Receipt,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { useSettings } from '@/lib/settings';
import { cn, formatPrice, pluralize } from '@/lib/utils';

const FORMAT_COLORS: Record<string, string> = {
  CD: 'var(--color-accent)',
  Vinyl: 'var(--color-coral)',
  Cassette: '#7fb8f5',
  Digital: '#c6a5ff',
  Other: 'rgba(255,255,255,0.35)',
};

function MoneyCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.07] bg-white/[0.03] text-accent">
          <Icon size={16} />
        </span>
        <span className="text-[9px] tracking-[0.14em] text-muted/40 uppercase">
          {hint}
        </span>
      </div>
      <p className="mt-4 truncate font-display text-2xl font-semibold tabular-nums text-cream">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

function SpendingSkeleton() {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <div className="skeleton h-3 w-40" />
        <div className="skeleton h-8 w-24 rounded-full" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="panel p-5">
            <div className="skeleton h-9 w-9 rounded-full" />
            <div className="skeleton mt-4 h-7 w-28" />
            <div className="skeleton mt-2 h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="panel mt-3 p-6">
        <div className="skeleton h-4 w-36" />
        <div className="skeleton mt-6 h-40 w-full" />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="panel p-6">
          <div className="skeleton h-4 w-28" />
          <div className="skeleton mt-5 h-32 w-full" />
        </div>
        <div className="panel p-6">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton mt-5 h-32 w-full" />
        </div>
      </div>
    </div>
  );
}

export function SpendingInsights() {
  const { settings } = useSettings();
  const [currency, setCurrency] = useState<string | null>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['spending', currency],
    queryFn: () => api.spending(currency ?? undefined),
    staleTime: 60_000,
  });

  if (isLoading) return <SpendingSkeleton />;

  if (isError || !data) {
    return (
      <div className="panel mt-6 flex flex-col items-center px-6 py-16 text-center">
        <Wallet size={28} className="text-coral" />
        <p className="mt-3 text-sm font-medium text-cream">
          Could not load spending insights
        </p>
        <p className="mt-1 text-xs text-muted">
          {error instanceof Error ? error.message : 'Try again in a moment.'}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="btn btn-secondary mt-4"
        >
          Try again
        </button>
      </div>
    );
  }

  const activeCurrency = data.currency || settings.defaultCurrency;
  const priced = data.currencies.some((item) => item.count > 0);

  if (!priced) {
    return (
      <div className="panel mt-6 flex flex-col items-center px-6 py-20 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-accent">
          <Receipt size={24} />
        </span>
        <h2 className="mt-4 font-display text-xl font-semibold text-cream">
          No spending data yet
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
          Add a price and purchase date from any release’s Edit details. Then
          this page will show where your money goes.
        </p>
        <Link to="/" className="btn btn-secondary mt-6">
          Open library
        </Link>
      </div>
    );
  }

  const maxMonth = Math.max(1, ...data.monthly.map((month) => month.amount));
  const monthlyTotal = data.monthly.reduce(
    (sum, month) => sum + month.amount,
    0,
  );
  const totalFormat = data.byFormat.reduce(
    (sum, format) => sum + format.amount,
    0,
  );
  const maxShop = Math.max(1, ...data.topShops.map((shop) => shop.amount));

  let cursor = 0;
  const donutSegments = data.byFormat
    .map((format) => {
      const start = cursor;
      cursor += totalFormat ? (format.amount / totalFormat) * 100 : 0;
      return `${FORMAT_COLORS[format.format] ?? FORMAT_COLORS.Other} ${start}% ${cursor}%`;
    })
    .join(', ');

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {pluralize(data.releasesWithPrice, 'priced record')}
          {data.firstPurchaseYear
            ? ` · collecting since ${data.firstPurchaseYear}`
            : ''}
        </p>
        {data.currencies.length > 1 ? (
          <div className="relative">
            <select
              value={activeCurrency}
              onChange={(event) => setCurrency(event.target.value)}
              className="select pr-8"
              aria-label="Currency"
            >
              {data.currencies.map((item) => (
                <option key={item.currency} value={item.currency}>
                  {item.currency} · {item.count}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
            />
          </div>
        ) : (
          <span className="chip cursor-default">{activeCurrency}</span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MoneyCard
          icon={Wallet}
          label="Total invested"
          value={formatPrice(data.totalSpent, activeCurrency)}
          hint="All time"
        />
        <MoneyCard
          icon={Receipt}
          label="Average per record"
          value={formatPrice(data.averagePrice, activeCurrency)}
          hint={
            data.medianPrice !== null
              ? `Median ${formatPrice(data.medianPrice, activeCurrency)}`
              : 'Median —'
          }
        />
        <MoneyCard
          icon={CalendarDays}
          label={`Spent in ${data.currentYear}`}
          value={formatPrice(data.spentThisYear, activeCurrency)}
          hint="This year"
        />
      </div>

      <section className="panel mt-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-cream">
              Spending over time
            </h2>
            <p className="mt-0.5 text-xs text-muted">Last 12 months</p>
          </div>
          {data.mostExpensive && (
            <Link
              to={`/releases/${data.mostExpensive.id}`}
              className="group max-w-[240px] text-right"
            >
              <p className="text-[9px] tracking-[0.14em] text-muted/50 uppercase">
                Most expensive
              </p>
              <p className="mt-0.5 truncate text-xs text-cream/80 transition group-hover:text-cream">
                {data.mostExpensive.title} ·{' '}
                <span className="text-accent">
                  {formatPrice(
                    data.mostExpensive.price,
                    data.mostExpensive.currency,
                  )}
                </span>
              </p>
            </Link>
          )}
        </div>

        {monthlyTotal === 0 ? (
          <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-white/10 px-4 py-10 text-center">
            <CalendarDays size={20} className="text-muted/50" />
            <p className="mt-2 text-xs text-muted">
              No purchases in the last 12 months.
            </p>
          </div>
        ) : (
          <div className="mt-6 flex h-44 items-stretch gap-1.5 sm:gap-2">
            {data.monthly.map((month, index) => {
              const height =
                month.amount > 0
                  ? Math.max(4, Math.round((month.amount / maxMonth) * 100))
                  : 2;
              const current = index === data.monthly.length - 1;
              return (
                <div
                  key={month.key}
                  className="group flex h-full min-w-0 flex-1 flex-col items-center gap-2"
                  title={`${month.label}: ${formatPrice(month.amount, activeCurrency)} · ${pluralize(month.count, 'record')}`}
                >
                  <span className="text-[9px] tabular-nums whitespace-nowrap text-muted/70 opacity-0 transition group-hover:opacity-100">
                    {month.amount > 0
                      ? formatPrice(month.amount, activeCurrency)
                      : ''}
                  </span>
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className={cn(
                        'w-full rounded-t-md transition-all duration-500',
                        month.amount > 0
                          ? 'bg-gradient-to-t from-accent/20 to-accent/80 group-hover:from-accent/30 group-hover:to-accent'
                          : 'bg-white/[0.06]',
                        current && month.amount > 0 && 'to-accent',
                      )}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      'text-[9px] tracking-wide',
                      current ? 'text-accent' : 'text-muted/50',
                    )}
                  >
                    {month.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <section className="panel p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-cream">
                Where it goes
              </h2>
              <p className="mt-0.5 text-xs text-muted">Spend by format</p>
            </div>
            <Disc3 size={18} className="text-muted/40" />
          </div>

          <div className="mt-5 flex items-center gap-5">
            <div
              className="relative h-28 w-28 shrink-0 rounded-full"
              style={{ background: `conic-gradient(${donutSegments})` }}
            >
              <div className="absolute inset-[13%] flex flex-col items-center justify-center rounded-full bg-ink-900">
                <span className="text-[8px] tracking-[0.16em] text-muted/50 uppercase">
                  Formats
                </span>
                <span className="font-display text-lg font-semibold text-cream">
                  {data.byFormat.length}
                </span>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              {data.byFormat.map((format) => (
                <div
                  key={format.format}
                  className="flex items-center gap-2 text-[11px]"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      background:
                        FORMAT_COLORS[format.format] ?? FORMAT_COLORS.Other,
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate text-cream/80">
                    {format.format}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {totalFormat
                      ? Math.round((format.amount / totalFormat) * 100)
                      : 0}
                    %
                  </span>
                  <span className="w-16 shrink-0 text-right tabular-nums text-cream/70">
                    {formatPrice(format.amount, activeCurrency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-cream">
                Favourite shops
              </h2>
              <p className="mt-0.5 text-xs text-muted">Top 3 by spend</p>
            </div>
            <MapPin size={18} className="text-muted/40" />
          </div>

          {data.topShops.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
              <p className="text-xs text-muted">
                No purchase locations yet. Add a shop when you edit a release.
              </p>
            </div>
          ) : (
            <ol className="mt-4 space-y-1">
              {data.topShops.map((shop, index) => (
                <li
                  key={shop.location}
                  className="relative overflow-hidden rounded-lg"
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-accent/[0.06]"
                    style={{ width: `${(shop.amount / maxShop) * 100}%` }}
                  />
                  <div className="relative flex items-center gap-3 px-3 py-2.5">
                    <span className="w-5 text-[10px] tabular-nums text-muted/40">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-cream/90">
                      {shop.location}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted/60">
                      {pluralize(shop.count, 'record')}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-cream/80">
                      {formatPrice(shop.amount, activeCurrency)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {data.missingPurchaseInfo > 0 && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-[11px] text-muted">
            <Info size={13} className="shrink-0 text-accent/70" />
            {pluralize(data.missingPurchaseInfo, 'record')} missing a price or
            purchase date.
          </p>
          <Link
            to="/"
            className="text-[11px] font-medium text-accent transition hover:text-accent-soft"
          >
            Open library
          </Link>
        </div>
      )}
    </div>
  );
}
