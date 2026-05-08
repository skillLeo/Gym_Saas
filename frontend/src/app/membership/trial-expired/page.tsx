'use client';

import { DashboardShell } from '@/components/layout/DashboardShell';
import { Button } from '@/components/ui/Button';
import { Lock, Crown, CheckCircle } from 'lucide-react';
import Link from 'next/link';

const features = [
  'AI Personal Trainer powered by GPT-4',
  'Food journal with 500K+ food database',
  'Barcode scanning & photo food logging',
  'Advanced workout & body tracking',
  'Meal planner & shopping list',
  'Community social features',
  'Achievements & streak tracking',
];

export default function TrialExpiredPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">

        {/* Lock Icon */}
        <div className="relative inline-flex mb-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#F87404] to-[#FF5C04] flex items-center justify-center shadow-2xl shadow-orange-500/40">
            <Lock size={36} className="text-white" />
          </div>
          <div className="absolute -top-2 -right-2 text-3xl">⏰</div>
        </div>

        <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Your Free Trial Has Ended
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
          You&apos;ve had 30 days of full access. To keep crushing your fitness goals, choose a plan that works for you.
        </p>

        {/* Features */}
        <div className="bg-white dark:bg-[#1a1a1a] rounded-3xl border border-gray-100 dark:border-white/[0.07] p-6 mb-6 text-left">
          <div className="flex items-center gap-2 mb-4">
            <Crown size={18} className="text-[#F87404]" />
            <span className="font-semibold text-gray-900 dark:text-white">What you&apos;ll keep with Pro</span>
          </div>
          <ul className="space-y-3">
            {features.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle size={15} className="text-[#F87404] shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <Link href="/membership/subscribe">
            <Button fullWidth size="lg" icon={<Crown size={18} />}>
              Subscribe to Pro — $13.33/month
            </Button>
          </Link>
          <Link href="/membership">
            <Button variant="outline" fullWidth size="md">
              View all plans
            </Button>
          </Link>
          <Link href="/dashboard">
            <button className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              Continue with limited access
            </button>
          </Link>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          30-day money-back guarantee · Cancel anytime · No hidden fees
        </p>
      </div>
    </div>
  );
}
