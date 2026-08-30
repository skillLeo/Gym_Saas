'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/States';
import { useI18nStore } from '@/store/i18nStore';
import api from '@/lib/api';

/**
 * Is automatic nutrition lookup actually available?
 *
 * `null` = not known yet (or the probe failed, which is not evidence of
 * anything). `false` = the server has no Nutritionix credentials, so barcode,
 * photo log and voice log cannot resolve nutrition at all.
 */
export function useFoodDbConnected(): boolean | null {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    api.get('/food/integration-status')
      .then(res => setConnected(Boolean(res.data?.nutritionix)))
      .catch(() => setConnected(null));
  }, []);

  return connected;
}

/**
 * Barcode scanning, Photo Log and Voice Log all resolve nutrition through
 * Nutritionix. When no credentials are configured those endpoints return 503,
 * and each screen handled that — but only *after* the member had scanned a
 * code, or taken a photo and typed a description. Until then the screens
 * advertised themselves as "AI Powered" and promised the nutrition would be
 * worked out automatically.
 *
 * This says so up front instead. It renders nothing when the integration is
 * live, so it costs nothing once credentials are in place. Pair it with
 * `useFoodDbConnected()` to hide the "AI Powered" badge and the "our AI will
 * calculate the nutrition automatically" copy — otherwise the screen carries a
 * warning and a promise that contradict each other.
 */
export function FoodDbNotice() {
  const { t } = useI18nStore();
  const connected = useFoodDbConnected();

  if (connected !== false) return null;

  return (
    <div className="px-4 pb-3 shrink-0">
      <Alert tone="warning" title={t('foodDb.notConnectedTitle')}>
        {t('foodDb.notConnectedBody')}
      </Alert>
    </div>
  );
}
