'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FoodLogRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/food-journal'); }, [router]);
  return null;
}
