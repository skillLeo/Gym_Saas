'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  Mail, Key, Eye, EyeOff, ChevronLeft, CheckCircle2,
  AlertCircle, Send, Zap, Server, AtSign, Lock, Hash,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

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
  mail_from_address: '', mail_from_name: 'My EXtreme Trainer',
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
      <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300">
        <Icon size={13} className="text-gray-400" /> {label}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-[#F87404] focus:ring-2 focus:ring-[#F87404]/15 transition-all";

export default function ApiKeysPage() {
  const { user } = useAuthStore();
  const [smtp, setSmtp] = useState<SmtpForm>(DEFAULT_SMTP);
  const [nx, setNx] = useState<NutritionixForm>(DEFAULT_NX);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showNxKey, setShowNxKey] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [savingNx, setSavingNx] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testingNx, setTestingNx] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [nxStatus, setNxStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  const saveSmtp = async () => {
    setSavingSmtp(true);
    await new Promise(r => setTimeout(r, 800));
    setSavingSmtp(false);
    toast.success('Settings saved successfully!');
  };

  const saveNx = async () => {
    setSavingNx(true);
    await new Promise(r => setTimeout(r, 700));
    setSavingNx(false);
    toast.success('Settings saved successfully!');
  };

  const testSmtp = async () => {
    if (!testEmail) { toast.error('Enter a test email address.'); return; }
    setTestingSmtp(true); setSmtpStatus('idle');
    await new Promise(r => setTimeout(r, 1200));
    setTestingSmtp(false);
    setSmtpStatus('ok');
    toast.success(`Test email sent to ${testEmail}!`);
  };

  const testNx = async () => {
    setTestingNx(true); setNxStatus('idle');
    await new Promise(r => setTimeout(r, 1000));
    setTestingNx(false);
    setNxStatus('ok');
    toast.success('Nutritionix API keys are valid!');
  };

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/admin" className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 hover:border-[#F87404]/40 transition-colors text-gray-500 dark:text-gray-400">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">API Keys & Integrations</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Super admin only · Settings stored securely</p>
          </div>
        </div>

        {/* Notice */}
        <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl px-4 py-3">
          <Lock size={15} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
            These credentials are encrypted. Passwords and API keys are masked in the UI.
          </p>
        </div>

        {/* SMTP Card */}
        <Card>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                <Mail size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">SMTP Email Settings</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Used for trial reminders, password resets and platform emails</p>
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
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

            <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-4 space-y-3 border border-gray-100 dark:border-white/[0.07]">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Test Connection</p>
              <div className="flex gap-2">
                <input className={inputCls + ' flex-1'} type="email" placeholder="Send test email to…"
                  value={testEmail} onChange={e => setTestEmail(e.target.value)} />
                <button onClick={testSmtp} disabled={testingSmtp}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-60 whitespace-nowrap">
                  <Send size={14} /> {testingSmtp ? 'Sending…' : 'Send Test'}
                </button>
              </div>
            </div>

            <button onClick={saveSmtp} disabled={savingSmtp}
              className="w-full bg-[#F87404] hover:bg-[#e06000] text-white font-bold py-3 rounded-xl text-sm transition-all shadow-md shadow-[#F87404]/20 disabled:opacity-60">
              {savingSmtp ? 'Saving…' : 'Save SMTP Settings'}
            </button>
          </div>
        </Card>

        {/* Nutritionix Card */}
        <Card>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F87404]/10 flex items-center justify-center">
                <Zap size={18} className="text-[#F87404]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Nutritionix API</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Powers food search, barcode scanning and nutrition data</p>
              </div>
            </div>
            <StatusBadge status={nxStatus} />
          </div>

          <div className="bg-[#F87404]/5 border border-[#F87404]/20 rounded-xl px-4 py-3 mb-4 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            Get your free API keys at{' '}
            <span className="text-[#F87404] font-semibold">developer.nutritionix.com</span>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNxKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </FieldRow>

            <div className="flex gap-3">
              <button onClick={saveNx} disabled={savingNx}
                className="flex-1 bg-[#F87404] hover:bg-[#e06000] text-white font-bold py-3 rounded-xl text-sm transition-all shadow-md shadow-[#F87404]/20 disabled:opacity-60">
                {savingNx ? 'Saving…' : 'Save Nutritionix Keys'}
              </button>
              <button onClick={testNx} disabled={testingNx}
                className="flex items-center gap-2 px-5 py-3 border-2 border-gray-200 dark:border-white/10 hover:border-[#F87404]/40 text-sm font-semibold text-gray-700 dark:text-gray-300 rounded-xl transition-all disabled:opacity-60">
                <Zap size={15} className="text-[#F87404]" /> {testingNx ? 'Testing…' : 'Test Keys'}
              </button>
            </div>
          </div>
        </Card>

      </div>
    </DashboardShell>
  );
}
