"use client"

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import LoginForm from '@/components/auth/login-form';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      {/* The one brand moment: a soft Heritage Gold wash with a coral tint. Decorative only, no text sits on it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-gold/40 via-coral/10 to-transparent dark:from-gold/15 dark:via-coral/5"
      />
      <div className="relative mx-auto w-full max-w-[400px] p-4">
        <LoginForm />
      </div>
    </main>
  );
}