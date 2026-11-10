import { cn } from '@/lib/utils';

function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function heatLevel(count: number): string {
  if (count === 0) return 'bg-white/[0.04]';
  if (count === 1) return 'bg-accent/25';
  if (count === 2) return 'bg-accent/45';
  if (count === 3) return 'bg-accent/70';
  return 'bg-accent';
}

export function AcquisitionHeatmap({
  days,
  title = 'Added over time',
  subtitle = 'Last 12 months',
}: {
  days: Array<{ date: string; count: number }>;
  title?: string;
  subtitle?: string;
}) {
  const counts = new Map(days.map((day) => [day.date, day.count]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sunday = new Date(today);
  sunday.setDate(sunday.getDate() - sunday.getDay());
  const start = new Date(sunday);
  start.setDate(start.getDate() - 52 * 7);

  const weeks: Array<Array<{ key: string; count: number; future: boolean }>> = [];
  for (let week = 0; week < 53; week += 1) {
    const cells = [];
    for (let day = 0; day < 7; day += 1) {
      const date = new Date(start);
      date.setDate(date.getDate() + week * 7 + day);
      const key = dayKey(date);
      cells.push({
        key,
        count: counts.get(key) ?? 0,
        future: date > today,
      });
    }
    weeks.push(cells);
  }

  return (
    <section className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold text-cream">{title}</h2>
          <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted/60">
          Less
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              key={level}
              className={cn('h-2.5 w-2.5 rounded-[2px]', heatLevel(level))}
            />
          ))}
          More
        </div>
      </div>
      <div className="mt-4 overflow-x-auto pb-1">
        <div className="flex gap-[3px]">
          {weeks.map((week) => (
            <div key={week[0].key} className="flex flex-col gap-[3px]">
              {week.map((day) => (
                <div
                  key={day.key}
                  className={cn(
                    'h-2.5 w-2.5 rounded-[2px]',
                    day.future ? 'bg-transparent' : heatLevel(day.count),
                  )}
                  title={`${day.key}: ${day.count}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
