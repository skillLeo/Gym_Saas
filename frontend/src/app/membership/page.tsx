'use client';
import Link from 'next/link';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { CreditCard, Crown, Check, Zap, Shield, ArrowRight, Star } from 'lucide-react';

const PLANS = [
  {
    name: 'Basic',
    price: '$7.99',
    color: 'border-gray-200',
    badge: null,
    features: ['Food journal & logging', 'Basic workout tracker', 'Water intake tracking', 'Community access'],
  },
  {
    name: 'Pro',
    price: '$14.99',
    color: 'border-[#F87404]',
    badge: 'Most Popular',
    features: ['Everything in Basic', 'AI Trainer access', 'Advanced analytics', 'Recipe library', 'Priority support'],
  },
  {
    name: 'Elite',
    price: '$24.99',
    color: 'border-purple-400',
    badge: 'Best Value',
    features: ['Everything in Pro', 'Personal coach sessions', 'Custom meal plans', 'Body composition tracking', 'Exclusive challenges'],
  },
];

export default function MembershipPage() {
  return (
    <DashboardShell>
      <div className="max-w-3xl mx-auto py-10 px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#F87404] to-[#FF5C04] flex items-center justify-center shadow-lg shadow-[#F87404]/25">
            <Crown size={28} className="text-white" />
          </div>
          <span className="inline-flex items-center gap-1.5 bg-[#F87404]/10 text-[#F87404] text-xs font-bold px-3 py-1 rounded-full border border-[#F87404]/20 mb-4">
            <Star size={11} /> Membership Plans
          </span>
          <h1 className="text-3xl font-black text-gray-900 mb-2">Choose Your Plan</h1>
          <p className="text-gray-500 text-sm">Upgrade anytime. Cancel anytime. No hidden fees.</p>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          {PLANS.map((plan) => (
            <div key={plan.name}
              className={`relative bg-white rounded-2xl border-2 ${plan.color} p-6 shadow-sm flex flex-col`}>
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#F87404] text-white text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap">
                  {plan.badge}
                </span>
              )}
              <div className="mb-4">
                <p className="font-bold text-gray-900 text-lg">{plan.name}</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-gray-900">{plan.price}</span>
                  <span className="text-gray-400 text-sm">/mo</span>
                </div>
              </div>
              <ul className="space-y-2.5 flex-1 mb-5">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check size={14} className="text-[#F87404] mt-0.5 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <button className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
                plan.badge === 'Most Popular'
                  ? 'bg-[#F87404] text-white hover:bg-[#e06000] shadow-md shadow-[#F87404]/25'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}>
                Get Started
              </button>
            </div>
          ))}
        </div>

        {/* Coming soon notice */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Zap size={18} className="text-blue-500" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm text-gray-900 mb-1">Payments coming soon</p>
            <p className="text-xs text-gray-500 leading-relaxed">Stripe integration is being finalised. You're currently on your free trial. We'll notify you when billing goes live.</p>
          </div>
          <Link href="/dashboard"
            className="shrink-0 flex items-center gap-1.5 text-[#F87404] font-bold text-xs hover:underline">
            Dashboard <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}
