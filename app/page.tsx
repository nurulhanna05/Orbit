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
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="mx-auto w-full max-w-[400px] p-4">
        <LoginForm />
      </div>
    </main>
  );
}