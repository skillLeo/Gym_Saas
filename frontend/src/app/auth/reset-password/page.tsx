'use client';
import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

function ResetForm() {
  const router = useRouter();
  const [form, setForm] = useState({ password: '', password_confirmation: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters.'); return; }
    if (form.password !== form.password_confirmation) { toast.error('Passwords do not match.'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    toast.success('Password updated successfully!');
    router.replace('/auth/login');
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Set new password</h2>
      <p className="text-gray-500 mb-8">Choose a strong password for your account.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="New Password" type="password" placeholder="Min 8 characters" value={form.password}
          onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
        <Input label="Confirm Password" type="password" placeholder="Repeat password" value={form.password_confirmation}
          onChange={e => setForm(p => ({ ...p, password_confirmation: e.target.value }))} required />
        <Button type="submit" loading={loading} className="w-full" size="lg">Reset Password</Button>
      </form>
      <div className="mt-4 text-center">
        <Link href="/auth/login" className="text-sm text-gray-500 hover:text-gray-900">← Back to login</Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetForm /></Suspense>;
}
