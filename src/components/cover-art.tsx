import { useEffect, useRef, useState } from 'react';
import { Disc3 } from 'lucide-react';
import { cn, hueFromString, proxiedCoverUrl } from '@/lib/utils';

type CoverArtProps = {
  src?: string | null;
  title: string;
  className?: string;
  iconSize?: number;
  onError?: () => void;
};

export function CoverArt({
  src,
  title,
  className,
  iconSize = 38,
  onError,
}: CoverArtProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const hue = hueFromString(title);
  const resolvedSrc = proxiedCoverUrl(src);
  const loaded = Boolean(resolvedSrc) && loadedSrc === resolvedSrc;
  const failed = Boolean(resolvedSrc) && failedSrc === resolvedSrc;
  const showImage = Boolean(resolvedSrc) && !failed;

  useEffect(() => {
    const image = imageRef.current;
    if (!resolvedSrc || !image?.complete || image.naturalWidth === 0) return;
    setLoadedSrc(resolvedSrc);
  }, [resolvedSrc]);

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
          key={resolvedSrc}
          ref={imageRef}
          src={resolvedSrc as string}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn(
            'relative h-full w-full object-cover transition-opacity duration-500',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
          onLoad={() => setLoadedSrc(resolvedSrc)}
          onError={() => {
            setFailedSrc(resolvedSrc);
            onError?.();
          }}
        />
      )}
    </div>
  );
}
