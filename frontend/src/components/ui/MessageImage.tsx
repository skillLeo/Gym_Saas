'use client';

import { useState } from 'react';
import { ImageOff } from 'lucide-react';

/**
 * A photo inside a chat bubble.
 *
 * Exists because a bare `<img>` whose src no longer resolves collapses to a
 * 0px-high box: the bubble renders as an empty rectangle with a timestamp and
 * nothing else, which reads as a rendering fault rather than a missing file.
 * Attachment URLs are stored absolute (host and port included), so any change
 * of origin — as happened here moving the API from :8000 to :8001 — silently
 * breaks every image saved before it.
 */
export function MessageImage({ src, className = '' }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-sunken px-3 py-2.5 mb-1.5 text-content-tertiary">
        <ImageOff size={15} strokeWidth={1.75} className="shrink-0" />
        <span className="text-caption">Image unavailable</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="Attachment"
      onError={() => setFailed(true)}
      className={`rounded-md max-w-full max-h-56 object-cover mb-1.5 ${className}`}
    />
  );
}
