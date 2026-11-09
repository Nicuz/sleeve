import { useEffect, useState } from 'react';
import { Disc3 } from 'lucide-react';
import { cn, hueFromString, proxiedCoverUrl } from '@/lib/utils';

type CoverArtProps = {
  src?: string | null;
  title: string;
  className?: string;
  iconSize?: number;
};

export function CoverArt({ src, title, className, iconSize = 38 }: CoverArtProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const hue = hueFromString(title);
  const resolvedSrc = proxiedCoverUrl(src);
  const showImage = Boolean(resolvedSrc) && !failed;

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  return (
    <div
      role="img"
      aria-label={`${title} cover`}
      className={cn('relative overflow-hidden bg-ink-800', className)}
      style={{
        backgroundImage: `linear-gradient(140deg, hsl(${hue} 30% 20%), hsl(${(hue + 48) % 360} 38% 10%))`,
      }}
    >
      {!(showImage && loaded) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <Disc3
            size={iconSize}
            strokeWidth={1.25}
            className="text-white/25"
            aria-hidden="true"
          />
          <span className="max-w-[80%] truncate text-[9px] font-semibold tracking-[0.18em] text-white/25 uppercase">
            {title}
          </span>
        </div>
      )}
      {showImage && (
        <img
          src={resolvedSrc as string}
          alt=""
          loading="lazy"
          className={cn(
            'relative h-full w-full object-cover transition-opacity duration-500',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setFailed(true);
            setLoaded(false);
          }}
        />
      )}
    </div>
  );
}
