'use client';

import { useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { mockAdminStats } from '@/lib/mockData';
import {
  ChevronLeft, Mail, Send, Users, CheckCircle, Eye, Clock,
  Zap, TrendingUp, Bell, Gift, AlertCircle, ChevronDown
} from 'lucide-react';
import Link from 'next/link';

const templates = [
  {
    id: 'welcome',
    name: 'Welcome Email',
    subject: 'Welcome to My EXtreme Trainer! 🎉',
    icon: Gift,
    color: '#F87404',
    body: `Hi [First Name],\n\nWelcome to My EXtreme Trainer! We're so excited to have you join thousands of members on their fitness journey.\n\nYour 30-day free trial has started. Here's what you can do right now:\n\n✅ Log your first meal in the Food Journal\n✅ Complete your fitness profile in Settings\n✅ Connect with the community in the Social Feed\n✅ Chat with your AI trainer for a personalized plan\n\nYour transformation starts today!\n\n— Team Extreme`,
  },
  {
    id: 'trial_ending',
    name: 'Trial Ending Soon',
    subject: '⏳ Your free trial ends in 3 days',
    icon: Clock,
    color: '#FFC000',
    body: `Hi [First Name],\n\nYour 30-day free trial of My EXtreme Trainer is ending in just 3 days.\n\nDon't lose access to:\n• Your food journal & nutrition history\n• Workout logs and progress charts\n• The social community\n• Your AI Trainer conversations\n\nSubscribe now for just $9.99/month and keep your momentum going!\n\n👉 [Subscribe Now]\n\n— Team Extreme`,
  },
  {
    id: 'new_feature',
    name: 'New Feature Announcement',
    subject: '🚀 New: AI Meal Visualizer is here!',
    icon: Zap,
    color: '#004AAD',
    body: `Hi [First Name],\n\nExciting news! We just launched the AI Meal Visualizer — a brand new tool that generates a beautiful image of any meal you describe.\n\nHow to use it:\n1. Go to AI Trainer → Meal Visualizer\n2. Describe your meal in text\n3. Watch the AI create a stunning food photo!\n\nWe're constantly adding new features to make your fitness journey easier and more enjoyable.\n\nTry it now 👇\n[Open Meal Visualizer]\n\n— Team Extreme`,
  },
  {
    id: 'weekly',
    name: 'Weekly Digest',
    subject: '📊 Your week in review — [Date Range]',
    icon: TrendingUp,
    color: '#10B981',
    body: `Hi [First Name],\n\nHere's your weekly summary for [Date Range]:\n\n📅 Workouts logged: [X]\n🥗 Meals tracked: [X] days\n💧 Average water intake: [X] glasses/day\n🔥 Total calories burned: [X]\n\nHighlights this week:\n• [Achievement unlocked]\n• [Streak maintained]\n\nKeep up the incredible work — you're building habits that last a lifetime.\n\nSee your full stats in the app 👇\n[Open Dashboard]\n\n— Team Extreme`,
  },
  {
    id: 'achievement',
    name: 'Achievement Unlocked',
    subject: '🏆 Congrats! You just unlocked an achievement!',
    icon: Bell,
    color: '#7C3AED',
    body: `Hi [First Name],\n\nYou just unlocked the "[Achievement Name]" achievement! 🎉\n\nThis is a big milestone and shows just how committed you are to your health and fitness goals.\n\nShare this achievement with the community — your progress inspires others!\n\n[View My Achievement]\n\nKeep going. The best is yet to come.\n\n— Team Extreme`,
  },
];

const recipientGroups = [
  { key: 'all', label: 'All Members', count: mockAdminStats.totalMembers, color: '#F87404' },
  { key: 'active', label: 'Active Subscribers', count: mockAdminStats.activeSubscribers, color: '#10B981' },
  { key: 'trial', label: 'Trial Users', count: mockAdminStats.trialUsers, color: '#FFC000' },
  { key: 'expired', label: 'Expired / Lapsed', count: mockAdminStats.expiredUsers, color: '#FF0404' },
];

const sentHistory = [
  { id: 1, subject: 'Welcome to My EXtreme Trainer! 🎉', recipients: 'All Members', sent: '2025-04-10', opens: '68%', clicks: '34%', status: 'sent' },
  { id: 2, subject: '⏳ Your free trial ends in 3 days', recipients: 'Trial Users', sent: '2025-04-08', opens: '72%', clicks: '41%', status: 'sent' },
  { id: 3, subject: '🚀 New: AI Meal Visualizer is here!', recipients: 'Active Subscribers', sent: '2025-04-05', opens: '55%', clicks: '28%', status: 'sent' },
  { id: 4, subject: '📊 Weekly Digest — Apr 1-7', recipients: 'All Members', sent: '2025-04-07', opens: '61%', clicks: '22%', status: 'sent' },
];

export default function AdminEmailsPage() {
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]);
  const [selectedRecipients, setSelectedRecipients] = useState('all');
  const [subject, setSubject] = useState(templates[0].subject);
  const [body, setBody] = useState(templates[0].body);
  const [preview, setPreview] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');

  const loadTemplate = (t: typeof templates[0]) => {
    setSelectedTemplate(t);
    setSubject(t.subject);
    setBody(t.body);
    setSent(false);
  };

  const handleSend = () => {
    setSending(true);
    setTimeout(() => { setSending(false); setSent(true); }, 1800);
  };

  const recipientCount = recipientGroups.find(r => r.key === selectedRecipients)?.count ?? 0;

  return (
    <DashboardShell>
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/[0.07] hover:border-[#F87404]/40 transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">Email Announcements</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Reach your entire community</p>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Emails Sent', val: '12', sub: 'This month', icon: Mail, color: '#F87404' },
            { label: 'Avg Open Rate', val: '64%', sub: 'Last 30 days', icon: Eye, color: '#10B981' },
            { label: 'Avg Click Rate', val: '31%', sub: 'Last 30 days', icon: TrendingUp, color: '#004AAD' },
            { label: 'Total Subscribers', val: mockAdminStats.totalMembers.toLocaleString(), sub: 'Reachable', icon: Users, color: '#7C3AED' },
          ].map(({ label, val, sub, icon: Icon, color }) => (
            <Card key={label} padding="sm">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '18' }}>
                    <Icon size={13} style={{ color }} />
                  </div>
                </div>
                <div className="font-display text-2xl font-bold text-gray-900 dark:text-white">{val}</div>
                <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* Tab toggle */}
        <div className="flex bg-gray-100 dark:bg-white/[0.07] p-1 rounded-xl mb-6 w-fit">
          {(['compose', 'history'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all ${activeTab === tab ? 'bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
              {tab === 'compose' ? 'Compose Email' : 'Sent History'}
            </button>
          ))}
        </div>

        {activeTab === 'compose' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Left: templates + recipients */}
            <div className="space-y-4">
              {/* Template picker */}
              <Card>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Email Templates</h3>
                  <div className="space-y-2">
                    {templates.map(t => {
                      const Icon = t.icon;
                      return (
                        <button key={t.id} onClick={() => loadTemplate(t)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${selectedTemplate.id === t.id ? 'border-[#F87404]/40 bg-[#F87404]/5' : 'border-gray-100 dark:border-white/[0.07] hover:border-gray-200 dark:hover:border-white/20'}`}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: t.color + '18' }}>
                            <Icon size={14} style={{ color: t.color }} />
                          </div>
                          <span className={`text-sm font-medium ${selectedTemplate.id === t.id ? 'text-[#F87404]' : 'text-gray-700 dark:text-gray-300'}`}>{t.name}</span>
                          {selectedTemplate.id === t.id && <CheckCircle size={13} className="text-[#F87404] ml-auto shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Card>

              {/* Recipients */}
              <Card>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3 flex items-center gap-2">
                    <Users size={14} className="text-[#F87404]" /> Recipients
                  </h3>
                  <div className="space-y-2">
                    {recipientGroups.map(g => (
                      <button key={g.key} onClick={() => setSelectedRecipients(g.key)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${selectedRecipients === g.key ? 'border-[#F87404]/40 bg-[#F87404]/5' : 'border-gray-100 dark:border-white/[0.07] hover:border-gray-200 dark:hover:border-white/20'}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{g.label}</span>
                        </div>
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{g.count.toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            {/* Right: composer */}
            <div className="lg:col-span-2">
              <Card>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Compose</h3>
                    <button onClick={() => setPreview(!preview)}
                      className="flex items-center gap-1.5 text-xs text-[#004AAD] font-medium hover:underline">
                      <Eye size={13} /> {preview ? 'Edit' : 'Preview'}
                    </button>
                  </div>

                  {/* Recipient summary */}
                  <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 dark:bg-white/[0.04] rounded-xl">
                    <Mail size={14} className="text-gray-400 shrink-0" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">To:</span>
                    <span className="text-xs font-semibold text-gray-900 dark:text-white">
                      {recipientGroups.find(r => r.key === selectedRecipients)?.label}
                    </span>
                    <span className="text-xs text-gray-400">({recipientCount.toLocaleString()} recipients)</span>
                  </div>

                  {/* Subject */}
                  <div className="mb-4">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block uppercase tracking-wide">Subject Line</label>
                    <input value={subject} onChange={e => setSubject(e.target.value)} disabled={preview}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F87404]/40 text-sm disabled:opacity-60" />
                  </div>

                  {/* Body */}
                  <div className="mb-5">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block uppercase tracking-wide">Email Body</label>
                    {preview ? (
                      <div className="w-full min-h-[280px] px-4 py-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                        {body}
                      </div>
                    ) : (
                      <textarea value={body} onChange={e => setBody(e.target.value)} rows={12}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F87404]/40 text-sm resize-none leading-relaxed" />
                    )}
                  </div>

                  {/* Send result */}
                  {sent ? (
                    <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-2xl">
                      <CheckCircle size={18} className="text-green-500 shrink-0" />
                      <div>
                        <div className="font-semibold text-green-700 dark:text-green-400 text-sm">Email Sent Successfully!</div>
                        <div className="text-xs text-green-600 dark:text-green-500">Delivered to {recipientCount.toLocaleString()} recipients</div>
                      </div>
                      <button onClick={() => setSent(false)} className="ml-auto text-xs text-green-600 dark:text-green-400 font-medium hover:underline">
                        Compose New
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <Button variant="outline" size="md" icon={<Eye size={15} />} onClick={() => setPreview(!preview)} className="flex-1">
                        {preview ? 'Back to Edit' : 'Preview Email'}
                      </Button>
                      <Button size="md" icon={<Send size={15} />} onClick={handleSend} className="flex-1" disabled={sending}>
                        {sending ? 'Sending...' : `Send to ${recipientCount.toLocaleString()}`}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>

              {/* Sending tips */}
              <div className="mt-4 flex items-start gap-2 p-4 bg-[#004AAD]/5 border border-[#004AAD]/10 rounded-2xl">
                <AlertCircle size={15} className="text-[#004AAD] shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  <strong>Tip:</strong> Use <code className="bg-gray-100 dark:bg-white/10 px-1 rounded">[First Name]</code> in the subject or body and it will be replaced with each recipient's name.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/[0.07] overflow-hidden shadow-sm">
            <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-3 border-b border-gray-100 dark:border-white/[0.07] bg-gray-50 dark:bg-white/[0.03]">
              <div className="col-span-5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Subject</div>
              <div className="col-span-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Recipients</div>
              <div className="col-span-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sent</div>
              <div className="col-span-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Opens</div>
              <div className="col-span-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Clicks</div>
              <div className="col-span-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</div>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
              {sentHistory.map(email => (
                <div key={email.id} className="sm:grid grid-cols-12 gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                  <div className="col-span-5 flex items-center gap-2 mb-2 sm:mb-0">
                    <Mail size={13} className="text-[#F87404] shrink-0" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{email.subject}</span>
                  </div>
                  <div className="col-span-2 hidden sm:flex items-center text-xs text-gray-500 dark:text-gray-400">{email.recipients}</div>
                  <div className="col-span-2 hidden sm:flex items-center text-xs text-gray-500 dark:text-gray-400">{email.sent}</div>
                  <div className="col-span-1 hidden sm:flex items-center text-sm font-semibold text-green-600 dark:text-green-400">{email.opens}</div>
                  <div className="col-span-1 hidden sm:flex items-center text-sm font-semibold text-[#004AAD]">{email.clicks}</div>
                  <div className="col-span-1 hidden sm:flex items-center">
                    <Badge variant="green" size="sm">{email.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="h-20" />
      </div>
    </DashboardShell>
  );
}
