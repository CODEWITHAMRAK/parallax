"use client";

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/onboarding');
    }
  }, [status, router]);
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-[800px] w-full text-center space-y-8 flex flex-col items-center">
        <img 
          src="/logo.png" 
          alt="Parallax Logo" 
          className="w-24 h-24 md:w-32 md:h-32 object-contain rounded-2xl shadow-lg border border-slate-100 p-2 bg-white"
        />
        <h1 className="font-heading text-5xl md:text-7xl text-[#003441] tracking-tight font-bold">
          Parallax
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground max-w-[600px] mx-auto">
          Complete digital services your way. Choose how you want to interact and let us guide you.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
          <Button 
            onClick={() => signIn('google', { callbackUrl: '/onboarding' })}
            className="h-[64px] px-8 rounded-lg bg-[#003441] text-white text-xl font-bold shadow-none hover:scale-105 transition-transform"
          >
            Get Started
          </Button>
        </div>
      </div>
    </main>
  );
}
