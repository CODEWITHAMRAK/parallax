"use client";

import React, { useEffect } from 'react';
import TextNavigationUI from '@/components/TextNavigationUI.jsx';
import useNavigationStore from '@/store/useNavigationStore.js';
import { Button } from '@/components/ui/button.jsx';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const { setPage, setSystemMessage } = useNavigationStore();
  const router = useRouter();

  useEffect(() => {
    setPage('home');
    setSystemMessage("Welcome to Parallax! You can tell me what you want to do, like 'Open the scholarship form'.");
  }, [setPage, setSystemMessage]);

  return (
    <main className="min-h-screen bg-background pb-[250px] flex flex-col items-center justify-center p-4">
      <div className="max-w-[800px] w-full text-center space-y-8 flex flex-col items-center">
        <img 
          src="/logo.png" 
          alt="Parallax Logo" 
          className="w-20 h-20 md:w-24 md:h-24 object-contain rounded-2xl shadow-md border border-slate-100 p-2 bg-white"
        />
        <h1 className="font-heading text-5xl md:text-6xl text-primary tracking-tight font-bold">
          Welcome to Parallax
        </h1>
        <p className="text-xl text-muted-foreground max-w-[600px] mx-auto">
          An accessibility-first platform designed to help you access digital government services with ease.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
          <Button 
            onClick={() => {
              setSystemMessage("Opening the scholarship form.");
              router.push('/form/scholarship_application');
            }}
            className="h-[64px] px-8 rounded-lg bg-primary text-primary-foreground text-xl font-bold shadow-none"
          >
            Open Scholarship Form
          </Button>
        </div>
      </div>

      <TextNavigationUI />
    </main>
  );
}
