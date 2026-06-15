'use client';
import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    setLoading(false);
    setSent(true);
    toast.success('Password reset link sent!');
  };

  if (sent) return (
    <div className="text-center">
      <div className="w-16 h-16 bg-[#3FB950]/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-3xl">✉️</span>
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Check your inbox</h2>
      <p className="text-gray-500 text-sm mb-6">We sent a password reset link to <strong className="text-gray-900">{email}</strong></p>
      <Link href="/auth/login" className="text-[#F87404] text-sm hover:underline">← Back to login</Link>
    </div>
  );

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Reset password</h2>
      <p className="text-gray-500 mb-8">Enter your email and we'll send you a reset link.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Email" type="email" placeholder="you@example.com" value={email}
          onChange={e => setEmail(e.target.value)} required />
        <Button type="submit" loading={loading} className="w-full" size="lg">Send Reset Link</Button>
      </form>
      <div className="mt-6 text-center">
        <Link href="/auth/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">← Back to login</Link>
      </div>
    </div>
  );
}
