import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Privacy Policy — My EXtreme Trainer' };

export default function PrivacyPage() {
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
        <h1 className="font-display text-3xl font-bold text-content-primary mb-2">Privacy Policy</h1>
        <p className="text-sm text-content-tertiary mb-10">Last updated August 2026 · Draft — pending legal review</p>

        <div className="space-y-8 text-content-secondary text-[15px] leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-content-primary mb-2">What we collect</h2>
            <p>Account details you give us (name, email, password), profile information you choose to add (bio, avatar, body measurements, goals), and activity you log in the app — meals, water intake, workouts, body stats, recipes, and posts or messages you send to other members. If you subscribe, Stripe processes your payment; we store which plan you&apos;re on and your billing status, not your card number.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-content-primary mb-2">How we use it</h2>
            <p>To run the app: showing your dashboard, calculating calorie and macro targets, tracking streaks and badges, powering the social feed, and processing your subscription. We also use it to send account-related emails (verification, trial reminders) and, if you opt in, product updates.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-content-primary mb-2">Health data and the coaching portal</h2>
            <p>Body stats, food logs, and workout history are health-adjacent data. We only share this with a physician if you explicitly submit a coaching authorization request and it&apos;s approved — the physician can then see only the data category you authorized, only for you, through a separate, password-protected portal. You can revoke that access at any time.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-content-primary mb-2">Who sees your content</h2>
            <p>Posts, comments, and profile info you mark as visible to other members can be seen by the community, following your privacy settings. Direct messages are visible only to the people in the conversation. Platform administrators can access account data to provide support, investigate abuse reports, or enforce these terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-content-primary mb-2">Third parties we use</h2>
            <p>Stripe for payment processing, and an email provider for transactional email (verification, reminders). We do not sell your personal data.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-content-primary mb-2">Your choices</h2>
            <p>You can edit or remove most profile information from Settings and control what&apos;s visible to other members. To have your account and its data deleted, contact us from Settings. Revoking a coaching authorization immediately cuts off that physician&apos;s access to new data.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-content-primary mb-2">Contact</h2>
            <p>Questions about this policy or a request to access or delete your data can be sent to the platform team through the in-app Messages page.</p>
          </section>

          <p className="text-xs text-content-tertiary pt-4 border-t border-border-subtle">
            This is a working draft written to accurately describe how the product functions today. It has not yet been reviewed by a lawyer and should be before public launch.
          </p>
        </div>
      </main>
    </div>
  );
}
