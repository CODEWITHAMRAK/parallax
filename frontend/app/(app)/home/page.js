"use client";

import React, { useEffect, useRef } from 'react';
import TextNavigationUI from '@/components/TextNavigationUI.jsx';
import useNavigationStore from '@/store/useNavigationStore.js';
import useLocalizationStore from '@/store/useLocalizationStore.js';
import { useVoiceStore, useVoice } from '@/hooks/useVoice.js';
import { Button } from '@/components/ui/button.jsx';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const { setPage, setSystemMessage, language } = useNavigationStore();
  const { interactionMode } = useVoiceStore();
  const { playSystemAudio } = useVoice();
  const t = useLocalizationStore(state => state.t);
  const router = useRouter();

  const isVoiceMode = interactionMode === 'voice';
  const hasGreetedRef = useRef(false);

  useEffect(() => {
    setPage('home');
    if (isVoiceMode && !hasGreetedRef.current) {
      hasGreetedRef.current = true;
      
      const initGreeting = async () => {
        if (language && language !== 'English') {
          await useLocalizationStore.getState().fetchDictionary(language);
        }
        let welcomeText = useLocalizationStore.getState().t('welcome_home');
        if (!welcomeText || welcomeText === 'welcome_home') {
          welcomeText = "Welcome to Parallax! You can tell me what you want to do, like 'Open the scholarship form'.";
        }
        setSystemMessage(welcomeText);

        setTimeout(async () => {
          try {
            await playSystemAudio("welcome_home");
          } catch (e) {
            console.warn("Autoplay prevented or audio failed:", e);
          } finally {
            setTimeout(() => {
              window.dispatchEvent(new Event('start-voice-turn'));
            }, 300);
          }
        }, 400);
      };

      initGreeting();
    } else if (!isVoiceMode) {
      setSystemMessage("");
    }
  }, [setPage, setSystemMessage, isVoiceMode, language, playSystemAudio]);

  return (
    <main className={`min-h-screen bg-background flex flex-col items-center justify-center p-4 ${isVoiceMode ? 'pb-[260px]' : 'pb-12'}`}>
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
              if (isVoiceMode) {
                setSystemMessage("Opening the scholarship form.");
              }
              router.push('/form/scholarship_application');
            }}
            className="h-[64px] px-8 rounded-xl bg-primary text-primary-foreground text-xl font-bold shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Open Scholarship Form
          </Button>
        </div>
      </div>

      {/* Voice & Assistant are ONLY rendered on Home Page in No-Touch Mode */}
      {isVoiceMode && <TextNavigationUI isHomeVoiceOnly={true} />}
    </main>
  );
}
