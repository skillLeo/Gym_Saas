'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

export interface UnreadCounts {
  messages: number;
  notifications: number;
  social: number;
  combined: number;
}

const EMPTY: UnreadCounts = { messages: 0, notifications: 0, social: 0, combined: 0 };

/**
 * Badge counts for the tab bar and More sheet (§2.1).
 *
 * Both requests fail silently: a badge is ancillary, and a dead counter must
 * never surface an error or block the shell from rendering. Polls on a slow
 * interval and pauses while the tab is hidden so a backgrounded PWA does not
 * sit hitting the API.
 */
export function useUnreadCounts(enabled = true): UnreadCounts {
  const [counts, setCounts] = useState<UnreadCounts>(EMPTY);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      if (document.visibilityState === 'hidden') return;

      const [msgRes, notifRes] = await Promise.allSettled([
        api.get('/messages'),
        api.get('/notifications/unread-count'),
      ]);

      if (cancelled) return;

      let messages = 0;
      if (msgRes.status === 'fulfilled') {
        const convs: { unread_count?: number }[] = msgRes.value.data?.conversations ?? [];
        messages = convs.reduce((acc, c) => acc + (c.unread_count ?? 0), 0);
      }

      let notifications = 0;
      if (notifRes.status === 'fulfilled') {
        const d = notifRes.value.data;
        notifications = d?.count ?? d?.data?.count ?? d?.unread_count ?? 0;
      }

      setCounts({
        messages,
        notifications,
        social: 0, // wired to feed activity in Stage 5 (Vibe Thread / feed features)
        combined: messages + notifications,
      });
    };

    load();
    // 60s made the nav badge feel broken: a message could sit for a full minute
    // with nothing on screen to say it had arrived. Both requests are cheap
    // counts and the poll is skipped entirely while the tab is hidden.
    const id = setInterval(load, 25_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled]);

  return counts;
}
