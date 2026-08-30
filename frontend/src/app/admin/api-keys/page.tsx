'use client';

import { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Alert } from '@/components/ui/States';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import toast from 'react-hot-toast';
import {
  Mail, Key, Eye, EyeOff, CheckCircle2,
  AlertCircle, Send, Zap, Server, AtSign, Lock, Hash
} from 'lucide-react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

interface SmtpForm {
  mail_host: string; mail_port: string; mail_username: string;
  mail_password: string; mail_encryption: string;
  mail_from_address: string; mail_from_name: string;
}

interface NutritionixForm {
  nutritionix_app_id: string; nutritionix_app_key: string;
}

const DEFAULT_SMTP: SmtpForm = {
  mail_host: 'smtp.gmail.com', mail_port: '587', mail_username: '',
  mail_password: '', mail_encryption: 'tls',
  mail_from_address: '', mail_from_name: 'My EXtreme Trainer'
};

const DEFAULT_NX: NutritionixForm = { nutritionix_app_id: '', nutritionix_app_key: '' };

function StatusBadge({ status }: { status: 'idle' | 'ok' | 'error' }) {
  if (status === 'idle') return null;
  return status === 'ok'
    ? <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium"><CheckCircle2 size={13} /> Connected</span>
    : <span className="flex items-center gap-1.5 text-xs text-red-500 font-medium"><AlertCircle size={13} /> Failed</span>;
}

function FieldRow({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-semibold text-content-secondary">
        <Icon size={13} className="text-content-tertiary" /> {label}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-surface-sunken border border-border-strong rounded-md px-4 py-2.5 text-sm text-content-primary placeholder:text-content-tertiary outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 transition-all";

/**
 * Wired to the real admin settings API.
 *
 * Every action on this page previously faked itself — `saveSmtp`, `saveNx`,
 * `testSmtp` and `testNx` each did `await new Promise(r => setTimeout(...))`
 * and then reported success. An admin could enter SMTP credentials, see
 * "Settings saved successfully!" and "Test email sent!", and nothing whatsoever
 * had happened. The endpoints (GET /admin/settings, POST /admin/settings/smtp,
 * /settings/test-smtp, /settings/nutritionix, /settings/test-nutritionix) were
 * already fully implemented in AdminController — only the frontend was faking.
 */
export default function ApiKeysPage() {
  const [smtp, setSmtp] = useState<SmtpForm>(DEFAULT_SMTP);
  const [nx, setNx] = useState<NutritionixForm>(DEFAULT_NX);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showNxKey, setShowNxKey] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [savingNx, setSavingNx] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testingNx, setTestingNx] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [nxStatus, setNxStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  // Load whatever is already stored so the admin edits real values.
  useEffect(() => {
    api.get('/admin/settings')
      .then((res) => {
        const d = res.data?.data ?? {};
        if (d.smtp) setSmtp((p) => ({ ...p, ...d.smtp }));
        if (d.nutritionix) setNx((p) => ({ ...p, ...d.nutritionix }));
      })
      .catch(() => toast.error('Could not load saved settings.'))
      .finally(() => setLoading(false));
  }, []);

  const saveSmtp = async () => {
    setSavingSmtp(true);
    try {
      await api.post('/admin/settings/smtp', smtp);
      toast.success('SMTP settings saved.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save SMTP settings. Check the fields and try again.'));
    } finally {
      setSavingSmtp(false);
    }
  };

  const saveNx = async () => {
    setSavingNx(true);
    try {
      await api.post('/admin/settings/nutritionix', nx);
      toast.success('Nutritionix keys saved.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save those keys.'));
    } finally {
      setSavingNx(false);
    }
  };

  const testSmtp = async () => {
    if (!testEmail) { toast.error('Enter an address to send the test to.'); return; }
    setTestingSmtp(true); setSmtpStatus('idle');
    try {
      await api.post('/admin/settings/test-smtp', { email: testEmail });
      setSmtpStatus('ok');
      toast.success(`Test email sent to ${testEmail}.`);
    } catch (err) {
      setSmtpStatus('error');
      toast.error(getErrorMessage(err, 'Test email failed. Check the host, port and credentials.'));
    } finally {
      setTestingSmtp(false);
    }
  };

  const testNx = async () => {
    setTestingNx(true); setNxStatus('idle');
    try {
      await api.post('/admin/settings/test-nutritionix', nx);
      setNxStatus('ok');
      toast.success('Nutritionix keys are valid.');
    } catch (err) {
      setNxStatus('error');
      toast.error(getErrorMessage(err, 'Those keys were rejected by Nutritionix.'));
    } finally {
      setTestingNx(false);
    }
  };

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto space-y-6">

        <PageHeader title="API Keys" subtitle="Super admin only" back="/admin" />

        {/* This previously warned that credentials were stored in plain text.
            That was true when written, but the `system_settings.value` column is
            now encrypted at rest (migration 2026_08_01_000001 + the `encrypted`
            cast on SystemSetting). Verified by round-tripping a real secret and
            reading the raw column back: it contains only a Laravel
            {"iv":...,"value":...,"mac":...} envelope, never the plaintext.
            Leaving the old warning up would be its own kind of dishonesty. */}
        <Alert tone="info" title="Credentials are encrypted at rest">
          Secrets are encrypted in the database with the application key and shown here masked.
          Saving a field blank leaves the stored value unchanged.
        </Alert>

        {/* SMTP Card */}
        <Card>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                <Mail size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-content-primary">SMTP Email Settings</h2>
                <p className="text-xs text-content-secondary">Used for trial reminders, password resets and platform emails</p>
              </div>
            </div>
            <StatusBadge status={smtpStatus} />
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="SMTP Host" icon={Server}>
                <input className={inputCls} placeholder="smtp.gmail.com" value={smtp.mail_host}
                  onChange={e => setSmtp(p => ({ ...p, mail_host: e.target.value }))} />
              </FieldRow>
              <FieldRow label="Port" icon={Hash}>
                <select className={inputCls} value={smtp.mail_port}
                  onChange={e => setSmtp(p => ({ ...p, mail_port: e.target.value }))}>
                  <option value="25">25 (None)</option>
                  <option value="465">465 (SSL)</option>
                  <option value="587">587 (TLS)</option>
                  <option value="2525">2525 (Alt)</option>
                </select>
              </FieldRow>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="Username / Email" icon={AtSign}>
                <input className={inputCls} placeholder="you@gmail.com" value={smtp.mail_username}
                  onChange={e => setSmtp(p => ({ ...p, mail_username: e.target.value }))} />
              </FieldRow>
              <FieldRow label="Password / App Password" icon={Lock}>
                <div className="relative">
                  <input className={inputCls + ' pr-11'} type={showSmtpPass ? 'text' : 'password'}
                    placeholder="••••••••••••" value={smtp.mail_password}
                    onChange={e => setSmtp(p => ({ ...p, mail_password: e.target.value }))} />
                  <button type="button" onClick={() => setShowSmtpPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content-secondary">
                    {showSmtpPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FieldRow>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="Encryption" icon={Lock}>
                <select className={inputCls} value={smtp.mail_encryption}
                  onChange={e => setSmtp(p => ({ ...p, mail_encryption: e.target.value }))}>
                  <option value="tls">TLS</option>
                  <option value="ssl">SSL</option>
                  <option value="starttls">STARTTLS</option>
                  <option value="null">None</option>
                </select>
              </FieldRow>
              <FieldRow label="From Name" icon={AtSign}>
                <input className={inputCls} placeholder="My EXtreme Trainer" value={smtp.mail_from_name}
                  onChange={e => setSmtp(p => ({ ...p, mail_from_name: e.target.value }))} />
              </FieldRow>
            </div>

            <FieldRow label="From Email Address" icon={Mail}>
              <input className={inputCls} type="email" placeholder="noreply@myextremetrainer.com"
                value={smtp.mail_from_address}
                onChange={e => setSmtp(p => ({ ...p, mail_from_address: e.target.value }))} />
            </FieldRow>

            <div className="bg-gray-50 dark:bg-white/[0.03] rounded-md p-4 space-y-3 border border-border-subtle">
              <p className="text-xs font-semibold text-content-secondary uppercase tracking-wide">Test Connection</p>
              <div className="flex gap-2">
                <input className={inputCls + ' flex-1'} type="email" placeholder="Send test email to…"
                  value={testEmail} onChange={e => setTestEmail(e.target.value)} />
                <button onClick={testSmtp} disabled={testingSmtp}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md transition-all disabled:opacity-60 whitespace-nowrap">
                  <Send size={14} /> {testingSmtp ? 'Sending…' : 'Send Test'}
                </button>
              </div>
            </div>

            <button onClick={saveSmtp} disabled={savingSmtp}
              className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-3 rounded-md text-sm transition-all disabled:opacity-60">
              {savingSmtp ? 'Saving…' : 'Save SMTP Settings'}
            </button>
          </div>
        </Card>

        {/* Nutritionix Card */}
        <Card>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-accent-surface flex items-center justify-center">
                <Zap size={18} className="text-accent" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-content-primary">Nutritionix API</h2>
                <p className="text-xs text-content-secondary">Powers food search, barcode scanning and nutrition data</p>
              </div>
            </div>
            <StatusBadge status={nxStatus} />
          </div>

          <div className="bg-accent/5 border border-accent/20 rounded-md px-4 py-3 mb-4 text-xs text-content-secondary leading-relaxed">
            Get your free API keys at{' '}
            <span className="text-accent font-semibold">developer.nutritionix.com</span>
            {' '}· Free tier: 500 API calls/day · Required for food log & calorie tracking.
          </div>

          <div className="space-y-4">
            <FieldRow label="App ID" icon={Key}>
              <input className={inputCls} placeholder="e.g. a1b2c3d4" value={nx.nutritionix_app_id}
                onChange={e => setNx(p => ({ ...p, nutritionix_app_id: e.target.value }))} />
            </FieldRow>

            <FieldRow label="App Key (API Key)" icon={Lock}>
              <div className="relative">
                <input className={inputCls + ' pr-11'} type={showNxKey ? 'text' : 'password'}
                  placeholder="••••••••••••••••••••••••••••••••"
                  value={nx.nutritionix_app_key}
                  onChange={e => setNx(p => ({ ...p, nutritionix_app_key: e.target.value }))} />
                <button type="button" onClick={() => setShowNxKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content-secondary">
                  {showNxKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </FieldRow>

            <div className="flex gap-3">
              <button onClick={saveNx} disabled={savingNx}
                className="flex-1 bg-accent hover:bg-accent-hover text-white font-bold py-3 rounded-md text-sm transition-all disabled:opacity-60">
                {savingNx ? 'Saving…' : 'Save Nutritionix Keys'}
              </button>
              <button onClick={testNx} disabled={testingNx}
                className="flex items-center gap-2 px-5 py-3 border-2 border-border-strong hover:border-accent/40 text-sm font-semibold text-content-secondary rounded-md transition-all disabled:opacity-60">
                <Zap size={15} className="text-accent" /> {testingNx ? 'Testing…' : 'Test Keys'}
              </button>
            </div>
          </div>
        </Card>

      </div>
    </DashboardShell>
  );
}
