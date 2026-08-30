import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Terms of Service — My EXtreme Trainer' };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-surface-base">
      <header className="sticky top-0 z-10 bg-surface-raised border-b border-border-subtle">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-content-secondary hover:text-content-primary text-sm font-medium">
            <ArrowLeft size={16} />
            Back
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="font-display text-3xl font-bold text-content-primary mb-2">Terms of Service</h1>
        <p className="text-sm text-content-tertiary mb-10">Last updated August 2026 · Draft — pending legal review</p>

        <div className="space-y-8 text-content-secondary text-[15px] leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-content-primary mb-2">1. Your account</h2>
            <p>You must provide accurate information when you register and keep your password secure. You&apos;re responsible for activity that happens under your account. You must be 18 or older, or have a parent or guardian&apos;s consent, to use My EXtreme Trainer.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-content-primary mb-2">2. Free trial and subscriptions</h2>
            <p>New accounts start with a 30-day free trial. After the trial ends, continued access requires an active paid subscription, billed through Stripe at the price shown at checkout. You can cancel anytime from Membership settings; cancelling stops future billing but does not retroactively refund a period already paid for, unless we say otherwise in writing.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-content-primary mb-2">3. Health and fitness content</h2>
            <p>My EXtreme Trainer helps you log meals, workouts, and body measurements, and calculates estimates (like calorie targets) from the information you provide. This is for general fitness tracking only — it is not medical advice, and it does not replace guidance from a doctor, dietitian, or other qualified professional. Talk to a healthcare provider before starting a new diet or exercise programme, especially if you have an existing health condition.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-content-primary mb-2">4. Coaching portal</h2>
            <p>If you authorize a physician to view your data through the coaching portal, that physician can see the workout, nutrition, and body-stat history you approved for the period the authorization is active. You can revoke access at any time from your account. We are a platform for sharing this data — we do not provide medical services ourselves.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-content-primary mb-2">5. Community content</h2>
            <p>Posts, comments, and messages you share with other members are your responsibility. Don&apos;t post anything illegal, harassing, or that infringes someone else&apos;s rights. We may remove content or suspend accounts that violate these terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-content-primary mb-2">6. Changes and termination</h2>
            <p>We may update these terms as the product changes; we&apos;ll post the new version here with a new date. To close your account, contact us from Settings and we&apos;ll process the deletion. We may suspend or terminate accounts that violate these terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-content-primary mb-2">7. Contact</h2>
            <p>Questions about these terms can be sent to the platform team through the in-app Messages page.</p>
          </section>

          <p className="text-xs text-content-tertiary pt-4 border-t border-border-subtle">
            This is a working draft written to accurately describe how the product functions today. It has not yet been reviewed by a lawyer and should be before public launch.
          </p>
        </div>
      </main>
    </div>
  );
}
