"use client"

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import LoginForm from '@/components/auth/login-form';
import { SiteFooter } from '@/components/layout/site-footer';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 items-center justify-center">
        <div className="mx-auto w-full max-w-[400px] p-4">
          <LoginForm />
        </div>
      </main>
      <SiteFooter className="mx-auto w-full max-w-5xl px-4 pb-6" />
    </div>
  );
}