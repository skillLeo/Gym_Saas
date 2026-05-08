'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, Lock, CreditCard, CheckCircle, Crown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SubscribePage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: 'Kelvin Silas', card: '', expiry: '', cvv: '', zip: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 2000));
    setLoading(false);
    setSuccess(true);
    setTimeout(() => router.push('/dashboard'), 2000);
  };

  const formatCard = (val: string) => val.replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim().slice(0, 19);
  const formatExpiry = (val: string) => val.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').slice(0, 5);

  if (success) {
    return (
      <DashboardShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <div className="text-6xl mb-4">🎉</div>
          <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-green-500/30">
            <CheckCircle size={32} className="text-white" />
          </div>
          <h2 className="font-display text-2xl font-bold text-gray-900 dark:text-white mb-2">Welcome to Pro!</h2>
          <p className="text-gray-500 dark:text-gray-400 text-center">Your subscription is active. Redirecting to dashboard...</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="max-w-md mx-auto px-4 py-6">

        <div className="flex items-center gap-3 mb-6">
          <Link href="/membership">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Subscribe to Pro</h1>
        </div>

        {/* Order Summary */}
        <div className="bg-gradient-to-br from-[#F87404]/10 to-[#FF5C04]/10 border border-[#F87404]/20 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-[#F87404] rounded-xl flex items-center justify-center">
              <Crown size={18} className="text-white" />
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white">Pro Plan — Annual</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Full access · All features</div>
            </div>
          </div>
          <div className="flex items-end justify-between border-t border-[#F87404]/20 pt-3">
            <div>
              <div className="text-xs text-gray-400 line-through">$239.88/year</div>
              <div className="text-xs text-green-500 font-medium">Save 33%</div>
            </div>
            <div className="text-right">
              <div className="font-display text-3xl font-bold text-[#F87404]">$159.99</div>
              <div className="text-xs text-gray-400">billed annually</div>
            </div>
          </div>
        </div>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl border border-gray-100 dark:border-white/[0.07] p-5 space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
              <CreditCard size={15} className="text-[#F87404]" /> Payment Details
            </h3>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Name on Card</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/50" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Card Number</label>
              <div className="relative">
                <input value={form.card} onChange={e => setForm(f => ({ ...f, card: formatCard(e.target.value) }))} required
                  placeholder="1234 5678 9012 3456" maxLength={19}
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/50 font-mono" />
                <CreditCard size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Expiry</label>
                <input value={form.expiry} onChange={e => setForm(f => ({ ...f, expiry: formatExpiry(e.target.value) }))} required
                  placeholder="MM/YY" maxLength={5}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/50 font-mono" />
              </div>
              <div className="col-span-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">CVV</label>
                <input value={form.cvv} onChange={e => setForm(f => ({ ...f, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))} required
                  placeholder="123" maxLength={4}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/50 font-mono" />
              </div>
              <div className="col-span-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">ZIP</label>
                <input value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value.replace(/\D/g, '').slice(0, 5) }))} required
                  placeholder="12345"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F87404]/50 font-mono" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Lock size={12} className="text-green-500 shrink-0" />
            <span>Your payment is secured with 256-bit SSL encryption via Stripe</span>
          </div>

          <Button type="submit" fullWidth size="lg" loading={loading} icon={<Lock size={16} />}>
            {loading ? 'Processing...' : 'Subscribe — $159.99/year'}
          </Button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          Cancel anytime · 30-day money-back guarantee
        </p>
        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
