"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import useNavigationStore from '@/store/useNavigationStore';
import useLocalizationStore, { useTranslation } from '@/store/useLocalizationStore';
import { useVoice, VoiceState } from '@/hooks/useVoice';
import { updateUserLanguage } from '@/lib/apiService';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', keywords: ['english', 'inglish', 'angrezi', 'angreji'] },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', keywords: ['hindi', 'हिन्दी', 'हिंदी', 'hindustani'] },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', keywords: ['kannada', 'kannad', 'kanada', 'ಕನ್ನಡ', 'kannadaa'] },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', keywords: ['tamil', 'thamizh', 'தமிழ்'] },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', keywords: ['telugu', 'telegu', 'తెలుగు'] },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', keywords: ['bengali', 'bangla', 'বাংলা'] },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', keywords: ['gujarati', 'gujrati', 'ગુજરાતી'] },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', keywords: ['malayalam', 'malyalam', 'മലയാളം'] },
  { code: 'mr', name: 'Marathi', native: 'मराठी', keywords: ['marathi', 'मराठी'] },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ಿଆ', keywords: ['odia', 'oriya', 'ଓଡ଼ିଆ'] },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', keywords: ['punjabi', 'panjabi', 'ਪੰਜਾਬੀ'] }
];

export default function LanguageSelectionPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const setStoreLanguage = useNavigationStore((state) => state.setLanguage);
  const t = useTranslation();
  const { interactionMode, setInteractionMode, startListening, pauseListening, playSystemAudio, speak, stopSpeaking, voiceState } = useVoice();

  const [step, setStep] = useState('mode'); // 'mode' | 'language'
  const [loading, setLoading] = useState(true);
  const [voiceStatusMsg, setVoiceStatusMsg] = useState('');
  const silenceTimerRef = useRef(null);
  const isTimeoutRef = useRef(false);

  useEffect(() => {
    if (voiceState === VoiceState.PROCESSING) {
      setVoiceStatusMsg("Processing...");
    }
  }, [voiceState]);

  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      pauseListening(false);
      stopSpeaking();
    };
  }, [pauseListening, stopSpeaking]);

  useEffect(() => {
    if (step === 'mode') {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      isTimeoutRef.current = true;
      pauseListening(false);
      stopSpeaking();
      setVoiceStatusMsg('');
    }
  }, [step, pauseListening, stopSpeaking]);

  useEffect(() => {
    if (step === 'language' && interactionMode === 'voice') {
      startVoiceLanguageSelection();
    }
  }, [step, interactionMode]);

  const handleBackToMode = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    isTimeoutRef.current = true;
    pauseListening(false);
    stopSpeaking();
    setVoiceStatusMsg('');
    setStep('mode');
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/api/auth/signin?callbackUrl=/onboarding");
      return;
    }

    if (status === "authenticated") {
      setLoading(false);
    }
  }, [status, session, router]);

  const handleLanguageSelect = async (languageName) => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    try {
      const currentStorage = JSON.parse(localStorage.getItem('navigation-storage') || '{}');
      localStorage.setItem('navigation-storage', JSON.stringify({
        ...currentStorage,
        state: { ...(currentStorage.state || {}), language: languageName }
      }));
    } catch (err) { }

    try {
      await updateUserLanguage(languageName);
      setStoreLanguage(languageName);
      await useLocalizationStore.getState().fetchDictionary(languageName);
      window.location.href = '/home';
    } catch (error) {
      console.error("Failed to save language:", error);
      setStoreLanguage(languageName);
      useLocalizationStore.getState().fetchDictionary(languageName);
      window.location.href = '/home';
    }
  };

  const startVoiceLanguageSelection = async () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    isTimeoutRef.current = false;

    setVoiceStatusMsg("Speaking...");
    try {
      await playSystemAudio('ask_language');
    } catch (err) {
      if (err.message === "INTERRUPTED") return;
      try {
        await speak("Please choose your language. Which language do you speak? ನೀವು ಯಾವ ಭಾಷೆಯನ್ನು ಮಾತನಾಡುತ್ತೀರಿ? आप कौन सी भाषा बोलते हैं?");
      } catch (e) {
        if (e.message === "INTERRUPTED") return;
      }
    }

    setVoiceStatusMsg("Listening... (Tell me your language)");

    silenceTimerRef.current = setTimeout(async () => {
      isTimeoutRef.current = true;
      pauseListening(false);
      setVoiceStatusMsg("Are you still there?");
      try {
        await playSystemAudio('are_you_there');
      } catch (e) {
        if (e.message === "INTERRUPTED") return;
        try {
          await speak("Are you still there? Please tell me which language you speak.");
        } catch (err) {
          if (err.message === "INTERRUPTED") return;
        }
      }
      setTimeout(() => startVoiceLanguageSelection(), 400);
    }, 8000);

    await startListening(
      async (transcribed) => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (isTimeoutRef.current) return;

        if (transcribed) {
          console.log("[Onboarding Voice] Transcribed:", transcribed);
          setVoiceStatusMsg(`Heard: "${transcribed}"`);
          const lower = transcribed.toLowerCase();

          let matchedLang = null;
          for (const lang of LANGUAGES) {
            if (
              lower.includes(lang.name.toLowerCase()) ||
              lower.includes(lang.native.toLowerCase()) ||
              (lang.keywords && lang.keywords.some(k => lower.includes(k)))
            ) {
              matchedLang = lang.name;
              break;
            }
          }

          if (matchedLang) {
            setVoiceStatusMsg(`Setting language to ${matchedLang}...`);
            await speak(`Setting language to ${matchedLang}`);
            handleLanguageSelect(matchedLang);
          } else {
            setVoiceStatusMsg("I didn't catch that. Please repeat.");
            try {
              await playSystemAudio('didnt_catch');
            } catch (e) {
              await speak("Sorry, I didn't catch that. Please tell me your language again.");
            }
            setTimeout(() => startVoiceLanguageSelection(), 400);
          }
        } else {
          setVoiceStatusMsg("I didn't catch that. Please repeat.");
          try {
            await playSystemAudio('didnt_catch');
          } catch (e) {
            await speak("Sorry, I didn't catch that. Please tell me your language again.");
          }
          setTimeout(() => startVoiceLanguageSelection(), 400);
        }
      },
      () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        setVoiceStatusMsg("Listening... (Recording your voice)");
      }
    );
  };

  const selectMode = (mode) => {
    setInteractionMode(mode);
    setStep('language');
  };

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-xl text-primary font-medium animate-pulse">Please wait...</p>
      </div>
    );
  }

  if (step === 'mode') {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 md:p-12 relative">
        <Button
          variant="ghost"
          onClick={() => signOut({ callbackUrl: '/' })}
          className="absolute top-4 right-4 md:top-6 md:right-6 text-muted-foreground hover:text-foreground font-mono"
        >
          {t('logout')}
        </Button>
        <div className="w-full max-w-[800px] text-center mb-16 mt-8 flex flex-col items-center">

          <h1 className="text-4xl md:text-5xl text-foreground font-extrabold tracking-tight mb-6">
            {t('welcome_parallax')}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground font-medium">
            {t('interact_how')}
          </p>
        </div>

        <div className="w-full max-w-[900px] flex flex-col md:flex-row items-center gap-6 justify-center">
          <Card
            onClick={() => selectMode('text')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                selectMode('text');
              }
            }}
            className="w-full md:w-1/2 h-[240px] cursor-pointer hover:bg-primary/5 hover:border-primary/30 flex flex-col items-center justify-center shadow-sm hover:-translate-y-1 transition-all group focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          >
            <CardContent className="flex flex-col items-center justify-center p-0">
              <span className="text-3xl text-primary font-bold mb-4 group-hover:scale-105 transition-transform">
                {t('normal_mode')}
              </span>
              <span className="text-lg text-muted-foreground font-medium text-center px-4">
                {t('normal_mode_desc')}
              </span>
            </CardContent>
          </Card>

          <Card
            onClick={() => selectMode('voice')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                selectMode('voice');
              }
            }}
            className="w-full md:w-1/2 h-[240px] bg-primary text-primary-foreground cursor-pointer flex flex-col items-center justify-center shadow-md hover:-translate-y-1 transition-transform group focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          >
            <CardContent className="flex flex-col items-center justify-center p-0">
              <span className="text-4xl font-bold mb-4 group-hover:scale-105 transition-transform">
                {t('no_touch_mode')}
              </span>
              <span className="text-xl opacity-90 font-medium text-center px-4">
                {t('no_touch_mode_desc')}
              </span>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (step === 'language' && interactionMode === 'voice') {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 md:p-12 pb-24 relative">
        <Button
          variant="ghost"
          onClick={() => signOut({ callbackUrl: '/' })}
          className="absolute top-4 right-4 md:top-6 md:right-6 text-muted-foreground hover:text-foreground font-mono"
        >
          {t('logout')}
        </Button>
        <div className="w-full max-w-[800px] text-center space-y-10">
          <div className="w-40 h-40 md:w-56 md:h-56 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-10 animate-pulse shadow-lg border border-border">
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </div>
          <h1 className="text-4xl md:text-6xl text-foreground tracking-tight font-extrabold">
            {voiceStatusMsg}
          </h1>
          <p className="text-2xl text-muted-foreground font-medium">
            Please speak your language (English, Hindi, Kannada, etc.)
          </p>
          <div className="pt-6 pb-10">
            <div className="flex flex-wrap justify-center gap-3 max-w-[700px] mx-auto">
              {LANGUAGES.map(lang => (
                <div key={lang.code} className="px-5 py-2 bg-card rounded-full border border-border shadow-sm text-foreground font-bold text-sm md:text-base">
                  {lang.native}
                </div>
              ))}
            </div>
          </div>
          <div className="pt-6">
            <Button onClick={handleBackToMode} variant="outline" size="lg" className="font-bold">
              {t('go_back')}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // Visual Language Selection
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 md:p-12 pb-24 relative">
      <Button
        variant="ghost"
        onClick={() => signOut({ callbackUrl: '/' })}
        className="absolute top-4 right-4 md:top-6 md:right-6 text-muted-foreground hover:text-foreground font-mono"
      >
        Logout
      </Button>
      <div className="w-full max-w-[800px] text-center mb-14 mt-8">

        <h1 className="text-4xl md:text-5xl text-foreground font-extrabold tracking-tight mb-4">
          {t('select_language')}
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground font-medium">
          {t('choose_language')}
        </p>
      </div>

      <div className="w-full max-w-[900px] flex flex-col items-center space-y-16">

        {/* All Languages */}
        <div className="w-full flex flex-col items-center">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5 w-full max-w-[800px]">
            {LANGUAGES.map((lang) => (
              <Card
                key={lang.code}
                onClick={() => handleLanguageSelect(lang.name)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleLanguageSelect(lang.name);
                  }
                }}
                className="h-[120px] cursor-pointer hover:bg-accent hover:text-accent-foreground flex flex-col items-center justify-center shadow-sm hover:-translate-y-1 transition-all group focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              >
                <CardContent className="flex flex-col items-center justify-center p-0">
                  <span className="text-4xl font-extrabold mb-2 group-hover:scale-110 transition-transform">
                    {lang.native}
                  </span>
                  <span className="text-lg font-medium opacity-80">
                    {lang.name}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="pt-12">
          <Button onClick={handleBackToMode} variant="outline" size="lg" className="font-bold">
            Go Back
          </Button>
        </div>

      </div>
    </main>
  );
}
