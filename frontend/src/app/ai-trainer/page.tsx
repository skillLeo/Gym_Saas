'use client';

import { useState, useRef, useEffect } from 'react';
import { formatDate } from '@/lib/format';
import type { Locale } from '@/store/i18nStore';
import { useI18nStore } from '@/store/i18nStore';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Alert } from '@/components/ui/States';
import { PageHeader } from '@/components/ui/PageHeader';
import { Bot, Send, Sparkles, Dumbbell, Utensils, TrendingDown, BookOpen, User, Trophy} from 'lucide-react';
import Link from 'next/link';

type Message = { id: string; role: 'user' | 'ai'; text: string; time: string };

/** Module scope: the locale is passed in by the caller. */
const now = (locale: Locale) => formatDate(new Date(), locale, { hour: '2-digit', minute: '2-digit' });

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'w1', role: 'ai',
    text: "Hey! I'm your AI Personal Trainer from My EXtreme Trainer. I'm here to help you crush your fitness goals, build meal plans, suggest recipes, and keep you accountable every day. What are we working on today? 💪",
    time: '9:00 AM',
  },
  {
    id: 'w2', role: 'user',
    text: 'Can you build me a workout plan for this week?',
    time: '9:01 AM',
  },
  {
    id: 'w3', role: 'ai',
    text: `Absolutely! Here's your 5-day split for this week:\n\n**Monday — Chest & Triceps**\nBench Press 4×8, Incline DB Press 3×10, Cable Flyes 3×12, Tricep Dips 3×10\n\n**Tuesday — Back & Biceps**\nDeadlifts 4×6, Pull-Ups 3×8, Seated Cable Row 3×10, Hammer Curls 3×12\n\n**Wednesday — Rest / Light Cardio**\n30 min walk or yoga\n\n**Thursday — Legs**\nSquats 4×8, Romanian Deadlifts 3×10, Leg Press 3×12, Calf Raises 4×15\n\n**Friday — Shoulders**\nOHP 4×8, Lateral Raises 3×15, Face Pulls 3×15, Shrugs 3×12\n\nAdjust weights so the last 2 reps are a challenge. Want me to add cardio or change any day?`,
    time: '9:01 AM',
  },
];

const QUICK_PROMPTS = [
  { icon: Dumbbell,     textKey: 'ai.prompt.workout' },
  { icon: Utensils,     textKey: 'ai.prompt.meal' },
  { icon: TrendingDown, textKey: 'ai.prompt.lose' },
  { icon: BookOpen,     textKey: 'ai.prompt.recipes' },
];

const AI_REPLIES: Array<{ keywords: string[]; reply: string }> = [
  {
    keywords: ['workout', 'exercise', 'training', 'gym', 'lift', 'strength'],
    reply: "Great question! For maximum results, I recommend a **push/pull/legs split**:\n\n**Push (Mon/Thu):** Bench press, shoulder press, tricep pushdowns\n**Pull (Tue/Fri):** Deadlifts, rows, pull-ups, curls\n**Legs (Wed/Sat):** Squats, lunges, leg press, calf raises\n\nAim for progressive overload — add 2.5–5 lbs each week. Want a more detailed plan for your goal?",
  },
  {
    keywords: ['meal', 'food', 'eat', 'diet', 'nutrition', 'calories', 'macro'],
    reply: "Here's a solid high-protein meal plan hitting ~2,000 kcal and 150g protein:\n\n🌅 **Breakfast:** 4 egg whites + 2 whole eggs scrambled, 1 cup oatmeal with berries (450 kcal, 35g protein)\n\n☀️ **Lunch:** Grilled chicken breast 6oz, brown rice 1 cup, broccoli 2 cups (550 kcal, 48g protein)\n\n🍎 **Snack:** Greek yogurt + handful of almonds (250 kcal, 20g protein)\n\n🌙 **Dinner:** Salmon fillet 6oz, sweet potato, green salad (500 kcal, 40g protein)\n\n💧 Drink 8 glasses of water daily. Want me to adjust for your calorie goal?",
  },
  {
    keywords: ['lose', 'weight', 'fat', 'slim', 'burn', 'lean'],
    reply: "The most effective fat loss strategy combines three things:\n\n**1. Calorie deficit (most important)**\nAim for 300–500 kcal below your maintenance. Track with the Food Journal.\n\n**2. Strength training 3–4× per week**\nBuilds muscle that burns more calories at rest. Don't skip this!\n\n**3. Daily movement**\nTarget 8,000–10,000 steps. Even walking is powerful for fat loss.\n\n**Realistic timeline:** 0.5–1 lb per week is healthy and sustainable. Crash diets backfire.\n\nYour current calorie goal is 2,000 kcal. Want me to calculate your exact deficit for your target weight?",
  },
  {
    keywords: ['recipe', 'cook', 'meal prep', 'food idea'],
    reply: "Here are 5 high-protein recipes perfect for your goals:\n\n1. **Chicken & Rice Bowl** — 45g protein, 520 kcal. Marinate chicken in soy + garlic, grill, serve over rice with edamame.\n\n2. **Salmon Poke Bowl** — 40g protein, 480 kcal. Sushi rice, cucumber, avocado, salmon, sesame dressing.\n\n3. **Turkey Meatballs** — 38g protein, 400 kcal. Lean ground turkey, garlic, herbs, baked not fried.\n\n4. **Overnight Oats** — 28g protein, 380 kcal. Oats, Greek yogurt, protein powder, berries, chia seeds.\n\n5. **Egg White Omelette** — 30g protein, 320 kcal. 6 egg whites, spinach, mushrooms, feta cheese.\n\nSaved to your Recipes page. Want the full step-by-step for any of these?",
  },
  {
    keywords: ['protein', 'muscle', 'gain', 'bulk', 'build'],
    reply: "To maximize muscle growth you need:\n\n**Nutrition:** Eat 0.8–1g of protein per lb of bodyweight daily. At 180 lbs, that's 144–180g of protein. Eat in a slight caloric surplus (200–300 kcal above maintenance).\n\n**Training:** Focus on compound movements (squat, deadlift, bench, row). Progressive overload is the key driver of muscle growth.\n\n**Recovery:** Sleep 7–9 hours. Muscles grow at rest, not in the gym. Take at least 1–2 rest days per week.\n\n**Supplement basics:** Creatine monohydrate (5g/day) is the most researched and proven supplement for muscle gain.\n\nConsistency over 3–6 months beats any quick fix. Want a full bulking meal plan?",
  },
  {
    keywords: ['cardio', 'run', 'endurance', 'hiit', 'cycling', 'steps'],
    reply: "Here's your cardio prescription based on your goals:\n\n**HIIT (2× per week):** 20 min total — 30 sec sprint / 60 sec walk. Burns calories in less time and boosts metabolism for hours after.\n\n**Steady-state (2× per week):** 30–45 min brisk walk or cycling at 60–70% max heart rate. Great for fat burning and recovery.\n\n**Daily steps:** Aim for 8,000–10,000. Take stairs, park further away, walk during calls.\n\n**Heart rate zones:**\n- Fat burn: 60–70% MHR\n- Cardio: 70–80% MHR\n- Peak: 80–90% MHR\n\nFor you at 30 years old: MHR ≈ 190 bpm. Fat burn zone = 114–133 bpm. Want me to build your weekly cardio calendar?",
  },
];

const DEFAULT_REPLY = "Great question! Based on your current fitness data and goals, here's what I recommend:\n\nFocus on consistency first. Even 3 workouts per week done consistently for 3 months will outperform the \"perfect\" plan you follow for 2 weeks. Track your food in the Food Journal daily, hit your water goal, and get 7–8 hours of sleep.\n\nSmall wins compound into big results. What specific area would you like to dive deeper into — training, nutrition, or recovery?";

function getAIReply(msg: string): string {
  const lower = msg.toLowerCase();
  for (const { keywords, reply } of AI_REPLIES) {
    if (keywords.some(k => lower.includes(k))) return reply;
  }
  return DEFAULT_REPLY;
}

/**
 * The canned replies are authored with markdown bold, and were being
 * rendered as raw text, so the asterisks appeared on screen. Splitting on the
 * delimiter and wrapping the odd segments keeps this to real React nodes - no
 * dangerouslySetInnerHTML, so a reply can never inject markup.
 */
function renderBold(text: string) {
  return text.split('**').map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>,
  );
}

export default function AITrainerPage() {
  const { t, locale } = useI18nStore();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const send = (text: string) => {
    const msg = text.trim();
    if (!msg) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text: msg, time: now(locale) };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      const aiMsg: Message = { id: `ai-${Date.now()}`, role: 'ai', text: getAIReply(msg), time: now(locale) };
      setMessages(prev => [...prev, aiMsg]);
    }, 1400 + Math.random() * 800);
  };

  return (
    <DashboardShell fullWidth>
      <div className="flex-1 min-h-0 flex flex-col max-w-3xl mx-auto w-full">

        {/* Removed a live green "Online · always ready" indicator. No AI service
            exists — the replies below are canned strings matched on keywords.
            The landing page now labels AI "Coming soon", and this screen has to
            agree with it rather than looking like a working product. */}
        <PageHeader
          title={t('ai.title')}
          subtitle={t('ai.preview')}
          actions={
            <Link
              href="/ai-trainer/achievements"
              aria-label={t('ai.achievements')}
              className="h-11 w-11 rounded-sm flex items-center justify-center text-content-secondary hover:text-content-primary hover:bg-surface-sunken transition-colors"
            >
              <Trophy size={20} strokeWidth={1.75} />
            </Link>
          }
        />

        <div className="px-4 pb-3 shrink-0">
          <Alert tone="info" title={t('ai.notBuilt')}>
            {t('ai.previewNotice')}
          </Alert>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 bg-gray-50/50 dark:bg-black/10">
          {messages.map(msg => (
            <div key={msg.id} className={`flex items-end gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {msg.role === 'ai' ? (
                <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[#F87404] to-[#FF5C04] flex items-center justify-center shrink-0">
                  <Bot size={15} className="text-white" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-md bg-gray-200 dark:bg-white/20 flex items-center justify-center shrink-0">
                  <User size={15} className="text-content-secondary dark:text-white" />
                </div>
              )}
              <div className={`max-w-[78%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`px-4 py-3 rounded-md text-sm leading-relaxed shadow-sm whitespace-pre-line ${
                  msg.role === 'user'
                    ? 'bg-accent text-white rounded-br-sm'
                    : 'bg-surface-raised text-gray-800 dark:text-gray-100 border border-border-subtle rounded-bl-sm'
                }`}>
                  {renderBold(msg.text)}
                </div>
                <span className="text-[10px] text-content-tertiary mt-1 px-1">{msg.time}</span>
              </div>
            </div>
          ))}

          {typing && (
            <div className="flex items-end gap-2.5">
              <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[#F87404] to-[#FF5C04] flex items-center justify-center shrink-0">
                <Bot size={15} className="text-white" />
              </div>
              <div className="bg-surface-raised border border-border-subtle px-4 py-3 rounded-md rounded-bl-sm flex gap-1 items-center shadow-sm">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick prompts */}
        <div className="px-4 pt-3 pb-2 flex gap-2 overflow-x-auto scrollbar-hide shrink-0 bg-surface-raised border-t border-border-subtle">
          {QUICK_PROMPTS.map(({ icon: Icon, textKey }) => (
            <button key={textKey} onClick={() => send(t(textKey))}
              className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 rounded-md bg-surface-sunken border border-border-strong text-xs font-medium text-content-secondary hover:border-accent hover:text-accent transition-colors shrink-0">
              <Icon size={13} className="text-accent" /> {t(textKey)}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="px-4 pb-4 pt-2 shrink-0 bg-surface-raised">
          <div className="flex items-end gap-2 bg-surface-sunken border border-border-strong rounded-md px-4 py-3 focus-within:border-accent transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder={t('ai.compose')}
              rows={1}
              className="flex-1 bg-transparent text-sm text-content-primary placeholder:text-content-tertiary dark:placeholder-gray-600 field-inset outline-none resize-none leading-relaxed"
              style={{ maxHeight: '120px' }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || typing}
              className="w-9 h-9 rounded-md bg-accent flex items-center justify-center text-white hover:bg-accent-hover transition-colors disabled:opacity-40 shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
          <p className="text-center text-[10px] text-content-tertiary mt-2">
            <Sparkles size={10} className="inline mr-1" />{t('ai.footer')}
          </p>
        </div>

      </div>
    </DashboardShell>
  );
}
