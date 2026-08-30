'use client';

import { useEffect, useState } from 'react';

/**
 * An <img> whose fallback survives a dead URL, not just a missing one.
 *
 * Every screen already had `src={url || FALLBACK}`, which only covers a MISSING
 * url. Several seeded Unsplash photos have since been removed and now return
 * 404 — those cards rendered the browser's broken-image icon and the alt text
 * instead of a picture. Falling back on the load ERROR as well as on an empty
 * value covers both, and covers any URL that rots later — including ones the
 * client adds themselves after handoff.
 *
 * Chromium reports these as ERR_BLOCKED_BY_ORB rather than a plain 404, because
 * Unsplash answers a dead photo with a non-image body; the `error` event fires
 * either way, so this handles both.
 */
const RECIPE_FALLBACK = '/images/recipe-placeholder.svg';
const MEDIA_FALLBACK  = '/images/media-placeholder.svg';

export function ImageWithFallback({
  src,
  alt,
  className,
  fallback = MEDIA_FALLBACK,
  loading = 'lazy',
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallback?: string;
  loading?: 'lazy' | 'eager';
}) {
  const [current, setCurrent] = useState(src || fallback);

  // A different item can be rendered into the same slot (grids reuse cards),
  // so reset when the source changes.
  useEffect(() => { setCurrent(src || fallback); }, [src, fallback]);

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => { if (current !== fallback) setCurrent(fallback); }}
    />
  );
}

/** Recipe photo — same behaviour, recipe-specific placeholder. */
export function RecipeImage(props: { src?: string | null; alt: string; className?: string }) {
  return <ImageWithFallback {...props} fallback={RECIPE_FALLBACK} />;
}
