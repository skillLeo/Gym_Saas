'use client';

import { useEffect, useState } from 'react';
import { useI18nStore } from '@/store/i18nStore';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/States';
import { fetchSubscription } from '@/lib/subscription';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Stethoscope, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import { useConfirm } from '@/components/ui/ConfirmDialog';

interface Authorization {
  id: number;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  physician_name: string;
  practice_name: string;
  practice_address: string;
  practice_phone: string;
  representative_name: string;
  representative_email: string;
  rejection_reason: string | null;
  created_at: string;
}

const STATUS_VARIANT: Record<Authorization['status'], string> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  revoked: 'neutral',
};

const emptyForm = {
  physician_name: '',
  practice_name: '',
  practice_address: '',
  practice_phone: '',
  representative_name: '',
  representative_email: '',
};

export default function CoachingAccessPage() {
  const { t } = useI18nStore();
  const { confirm } = useConfirm();
  const [isSubscriber, setIsSubscriber] = useState<boolean | null>(null);
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetchSubscription().catch(() => null),
      api.get('/coaching-authorizations'),
    ]).then(([sub, res]) => {
      setIsSubscriber(sub?.account_state === 'subscriber');
      setAuthorizations(res.data.authorizations ?? []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const hasOpenRequest = authorizations.some(a => a.status === 'pending' || a.status === 'approved');

  const submit = async () => {
    if (Object.values(form).some(v => !v.trim())) {
      toast.error(t('coaching.allRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/coaching-authorizations', form);
      setAuthorizations(prev => [res.data.authorization, ...prev]);
      setForm(emptyForm);
      setShowForm(false);
      toast.success(t('coaching.submitted'));
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('coaching.error.submit'));
    } finally {
      setSubmitting(false);
    }
  };

  const revoke = async (auth: Authorization) => {
    if (!(await confirm({ title: `Revoke ${auth.physician_name}'s access?`, message: t('coaching.revokeWarning'), confirmLabel: t('coaching.revokeLower'), destructive: true }))) return;
    setActingId(auth.id);
    try {
      const res = await api.post(`/coaching-authorizations/${auth.id}/revoke`);
      setAuthorizations(prev => prev.map(a => a.id === auth.id ? res.data.authorization : a));
      toast.success(t('coaching.revoked'));
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('coaching.error.revoke'));
    } finally {
      setActingId(null);
    }
  };

  return (
    <DashboardShell>
      <div data-section="coaching" className="max-w-2xl mx-auto px-4 py-6">
        <PageHeader
          title={t('coaching.title')}
          subtitle={t('coaching.subtitle')}
          back="/profile"
        />

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-accent" /></div>
        ) : !isSubscriber ? (
          <Alert tone="info" title={t('coaching.needSub')}>
            Physician coaching access is available to active paid subscribers. On a free trial?{' '}
            <Link href="/membership" className="font-semibold underline">{t('coaching.viewPlans')}</Link>.
          </Alert>
        ) : (
          <>
            <Card className="mb-5">
              <div className="p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-md bg-accent-surface flex items-center justify-center shrink-0">
                  <Stethoscope size={18} className="text-accent" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-content-primary mb-1">{t('coaching.howItWorks')}</p>
                  <p className="text-xs text-content-tertiary">
                    {t('coaching.howItWorksBody')}
                  </p>
                </div>
              </div>
            </Card>

            {!hasOpenRequest && !showForm && (
              <Button fullWidth icon={<Plus size={16} />} onClick={() => setShowForm(true)} className="mb-5">
                {t('coaching.requestTitle')}
              </Button>
            )}

            {showForm && (
              <Card className="mb-5">
                <div className="p-5 space-y-3">
                  <h3 className="font-semibold text-content-primary text-sm mb-1">{t('coaching.newRequest')}</h3>
                  {[
                    ['physician_name', t('coaching.physicianName')],
                    ['practice_name', t('coaching.practiceName')],
                    ['practice_address', t('coaching.practiceAddress')],
                    ['practice_phone', t('coaching.practicePhone')],
                    ['representative_name', t('coaching.contactName')],
                    ['representative_email', t('coaching.contactEmail')],
                  ].map(([key, placeholder]) => (
                    <input
                      key={key}
                      value={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      type={key === 'representative_email' ? 'email' : 'text'}
                      className="w-full px-4 py-2.5 rounded-md border border-border-strong bg-surface-sunken text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    />
                  ))}
                  <div className="flex gap-3 pt-1">
                    <Button variant="ghost" fullWidth onClick={() => { setShowForm(false); setForm(emptyForm); }}>{t('common.cancel')}</Button>
                    <Button fullWidth onClick={submit} loading={submitting}>{t('coaching.submit')}</Button>
                  </div>
                </div>
              </Card>
            )}

            {authorizations.length > 0 && (
              <>
                <h3 className="font-semibold text-content-primary text-sm mb-3">{t('coaching.yourRequests')}</h3>
                <div className="space-y-3">
                  {authorizations.map(a => (
                    <Card key={a.id}>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-content-primary truncate">{a.physician_name}</p>
                            <p className="text-xs text-content-tertiary truncate">{a.practice_name}</p>
                          </div>
                          <Badge variant={STATUS_VARIANT[a.status]}>{a.status}</Badge>
                        </div>
                        {a.status === 'rejected' && a.rejection_reason && (
                          <p className="text-xs text-content-tertiary mb-2">Reason: {a.rejection_reason}</p>
                        )}
                        <p className="text-[11px] text-content-tertiary">Requested {new Date(a.created_at).toLocaleDateString()}</p>
                        {a.status === 'approved' && (
                          <Button
                            variant="danger" size="sm" className="mt-3"
                            loading={actingId === a.id}
                            onClick={() => revoke(a)}
                          >
                            {t('coaching.revoke')}
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
