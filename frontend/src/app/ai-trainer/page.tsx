'use client';
import Link from 'next/link';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Bot, Sparkles, Brain, Dumbbell, Utensils, ArrowRight } from 'lucide-react';

const FEATURES = [
  { icon: Brain, title: 'Smart Coaching', desc: 'Personalised plans based on your goals and progress' },
  { icon: Dumbbell, title: 'Workout Generator', desc: 'AI-built workout routines tailored to your level' },
  { icon: Utensils, title: 'Meal Planning', desc: 'Intelligent meal suggestions matching your macros' },
  { icon: Sparkles, title: 'Progress Analysis', desc: 'Deep insights and actionable recommendations' },
];

export default function AITrainerPage() {
  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto py-10 px-4">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-[#F87404] to-[#FF5C04] flex items-center justify-center shadow-xl shadow-[#F87404]/25">
            <Bot size={36} className="text-white" />
          </div>
          <span className="inline-flex items-center gap-1.5 bg-[#F87404]/10 text-[#F87404] text-xs font-bold px-3 py-1 rounded-full border border-[#F87404]/20 mb-4">
            <Sparkles size={11} /> Coming Soon
          </span>
          <h1 className="text-3xl font-black text-gray-900 mb-3">Your AI Personal Trainer</h1>
          <p className="text-gray-500 text-base leading-relaxed max-w-md mx-auto">
            An intelligent coaching experience that adapts to you — your goals, your schedule, your progress.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-[#F87404]/10 flex items-center justify-center mb-3">
                <Icon size={18} className="text-[#F87404]" />
              </div>
              <p className="font-bold text-sm text-gray-900 mb-1">{title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-br from-[#F87404] to-[#FF5C04] rounded-2xl p-6 text-center text-white shadow-lg shadow-[#F87404]/20">
          <p className="font-bold text-lg mb-1">This feature is in development</p>
          <p className="text-white/80 text-sm mb-4">You'll be the first to know when it launches.</p>
          <Link href="/dashboard"
            className="inline-flex items-center gap-2 bg-white text-[#F87404] font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-white/90 transition-colors">
            Back to Dashboard <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}
