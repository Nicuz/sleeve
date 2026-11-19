import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { isDemoBuild } from '@/lib/build-info';
import { prepareCoverImage } from '@/lib/cover-image';
import { isUploadedCover } from '@/lib/utils';
import { CoverArt } from './cover-art';
import { useToast } from './toast';

export function CoverPicker({
  value,
  onChange,
  title,
  fallbackCoverUrl = null,
  showPreview = true,
  disabled = false,
}: {
  value: string | null;
  onChange: (value: string) => void;
  title: string;
  fallbackCoverUrl?: string | null;
  showPreview?: boolean;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadedRefs = useRef(new Set<string>());
  const [busy, setBusy] = useState(false);
  const uploaded = isUploadedCover(value);

  useEffect(() => {
    const refs = uploadedRefs.current;
    return () => {
      for (const coverUrl of refs) {
        const name = coverUrl.startsWith('upload:') ? coverUrl.slice(7) : null;
        if (name) void api.deleteCoverUpload(name).catch(() => undefined);
      }
      refs.clear();
    };
  }, []);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const prepared = await prepareCoverImage(file);
      const result = await api.uploadCover(prepared);
      uploadedRefs.current.add(result.coverUrl);
      onChange(result.coverUrl);
    } catch (error) {
      toast(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'Could not upload this image.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
      <div className={showPreview ? 'flex gap-3' : 'flex flex-wrap items-center gap-3'}>
        {showPreview && (
          <CoverArt
            src={value}
            title={title}
            className="h-24 w-24 shrink-0 rounded-xl"
            iconSize={22}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-cream">Cover art</p>
          <p className="mt-0.5 text-[11px] text-muted">
            {uploaded
              ? 'Uploaded image, kept when metadata refreshes.'
              : value
                ? 'Cover art from MusicBrainz.'
                : 'No cover yet.'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {!isDemoBuild && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={disabled || busy}
                className="btn btn-secondary px-3 py-1.5 text-[11px]"
              >
                {busy ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <ImagePlus size={12} />
                )}
                {busy ? 'Uploading' : uploaded ? 'Replace image' : 'Upload image'}
              </button>
            )}
            {uploaded && (
              <button
                type="button"
                onClick={() =>
                  onChange(
                    fallbackCoverUrl && fallbackCoverUrl !== value
                      ? fallbackCoverUrl
                      : '',
                  )
                }
                disabled={disabled || busy}
                className="btn btn-ghost px-3 py-1.5 text-[11px] text-muted hover:text-danger disabled:opacity-40"
              >
                <Trash2 size={12} />
                {fallbackCoverUrl && fallbackCoverUrl !== value
                  ? 'Remove custom cover'
                  : 'Remove'}
              </button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = '';
        }}
      />
    </div>
  );
}
