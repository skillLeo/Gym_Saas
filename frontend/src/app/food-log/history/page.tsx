'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FoodLogHistoryRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/food-journal/history'); }, [router]);
  return null;
}
