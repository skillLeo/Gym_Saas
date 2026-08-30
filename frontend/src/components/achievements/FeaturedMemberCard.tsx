'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Flame, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { dismissFeature, type FeedFeature } from '@/lib/achievements';
import type { FeedFeature as Feature } from '@/lib/achievements';

/**
 * A member surfaced in the feed for a sustained streak (§4.5).
 *
 * Visually distinct from a post — accent border, tinted surface, no post
 * chrome — but deliberately shorter than one, because the brief requires these
 * not dominate the feed. The API already caps them at three per load.
 *
 * The dismiss control appears only for the featured member themselves; the API
 * enforces that too, so the check here is presentation rather than security.
 */
export function FeaturedMemberCard({
  feature,
  isSelf,
  onDismissed,
}: {
  feature: Feature;
  isSelf: boolean;
  onDismissed?: (id: number) => void;
}) {
  const [hiding, setHiding] = useState(false);

  const isMonth = feature.feature_type === 'month_streak';
  const weeks = Math.floor(feature.days / 7);

  const headline = isMonth
    ? `${weeks} straight weeks`
    : `${feature.days} days in a row`;

  const name = feature.user.name ?? 'A member';
  const href = feature.user.username ? `/social/${feature.user.username}` : undefined;

  async function hide() {
    setHiding(true);
    try {
      await dismissFeature(feature.id);
      onDismissed?.(feature.id);
    } catch {
      setHiding(false);
    }
  }

  return (
    <article
      className={[
        'relative rounded-md p-4 flex items-center gap-3.5',
        isMonth
          ? 'border-2 border-accent bg-accent-surface'
          : 'border border-accent/35 bg-surface-raised',
      ].join(' ')}
    >
      <Avatar src={feature.user.avatar ?? undefined} name={name} size={isMonth ? 'lg' : 'md'} />

      <div className="min-w-0 flex-1">
        <p className="inline-flex items-center gap-1.5 text-caption font-semibold text-accent uppercase tracking-wide">
          <Flame size={13} strokeWidth={2.25} aria-hidden />
          {isMonth ? 'A full month' : 'Crushing it this week'}
        </p>

        <p className="font-display text-h3 text-content-primary mt-0.5 truncate">
          {href ? (
            <Link href={href} className="hover:text-accent transition-colors">{name}</Link>
          ) : name}
        </p>

        <p className="text-body-sm text-content-secondary mt-0.5">
          {headline}
          {isSelf && <span className="text-content-tertiary"> · that&apos;s you</span>}
        </p>
      </div>

      {isSelf && (
        <button
          type="button"
          onClick={hide}
          disabled={hiding}
          aria-label="Hide this from the feed"
          className="shrink-0 h-9 w-9 -mr-1 rounded-sm flex items-center justify-center text-content-tertiary hover:text-content-primary hover:bg-surface-sunken transition-colors disabled:opacity-50"
        >
          <X size={16} strokeWidth={2} />
        </button>
      )}
    </article>
  );
}
