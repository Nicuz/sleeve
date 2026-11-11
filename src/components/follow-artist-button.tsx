import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, UserCheck, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useToast } from './toast';

export function FollowArtistButton({
  artistId,
  name,
  compact = false,
  className,
}: {
  artistId: string | null | undefined;
  name: string;
  compact?: boolean;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const followsQuery = useQuery({
    queryKey: ['artist-follows'],
    queryFn: api.listFollowedArtists,
    staleTime: 5 * 60_000,
  });

  const followed = Boolean(
    artistId && followsQuery.data?.items.some((item) => item.artistId === artistId),
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!artistId) return;
      if (followed) {
        await api.unfollowArtist(artistId);
        return;
      }
      await api.followArtist(artistId, name);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['artist-follows'] });
      toast(
        followed ? `Unfollowed ${name}` : `Following ${name}`,
        followed ? 'info' : 'success',
      );
    },
    onError: (error) => {
      toast(
        error instanceof Error ? error.message : 'Could not update followed artists',
        'error',
      );
    },
  });

  if (!artistId) return null;
  const Icon = mutation.isPending ? Loader2 : followed ? UserCheck : UserPlus;

  return (
    <button
      type="button"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      aria-pressed={followed}
      className={cn(
        compact
          ? 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition disabled:opacity-60'
          : 'btn btn-secondary',
        compact &&
          (followed
            ? 'border-accent/30 bg-accent/10 text-accent'
            : 'border-white/10 bg-white/[0.02] text-muted hover:border-white/20 hover:text-cream'),
        className,
      )}
    >
      <Icon
        size={compact ? 10 : 14}
        className={mutation.isPending ? 'animate-spin' : undefined}
      />
      {followed ? 'Following' : compact ? 'Follow' : 'Follow artist'}
    </button>
  );
}
