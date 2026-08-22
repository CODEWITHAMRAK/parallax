"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import useNavigationStore from '@/store/useNavigationStore';
import useLocalizationStore from '@/store/useLocalizationStore';
import { useVoice, VoiceState } from '@/hooks/useVoice';
import { updateUserLanguage } from '@/lib/apiService';
import { Button } from '@/components/ui/button';

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

const STATE_LANGUAGE_MAP = {
  'karnataka': 'kn',
  'maharashtra': 'mr',
  'tamil nadu': 'ta',
  'kerala': 'ml',
  'gujarat': 'gu',
  'punjab': 'pa',
  'odisha': 'or',
  'west bengal': 'bn',
  'andhra pradesh': 'te',
  'telangana': 'te',
  'uttar pradesh': 'hi',
  'bihar': 'hi',
  'madhya pradesh': 'hi',
  'rajasthan': 'hi',
  'haryana': 'hi',
  'jharkhand': 'hi',
  'chhattisgarh': 'hi',
  'uttarakhand': 'hi',
  'himachal pradesh': 'hi',
  'delhi': 'hi'
};

export default function LanguageSelectionPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const setStoreLanguage = useNavigationStore((state) => state.setLanguage);
  const { interactionMode, setInteractionMode, startListening, pauseListening, playSystemAudio, speak, stopSpeaking, voiceState } = useVoice();
  
  const [step, setStep] = useState('mode'); // 'mode' | 'language'
  const [recommendedLang, setRecommendedLang] = useState(LANGUAGES[0]);
  const [otherLangs, setOtherLangs] = useState(LANGUAGES.slice(1));
  const [loading, setLoading] = useState(true);
  const [voiceStatusMsg, setVoiceStatusMsg] = useState('');
  const silenceTimerRef = useRef(null);
  const isTimeoutRef = useRef(false);

  useEffect(() => {
    if (voiceState === VoiceState.PROCESSING) {
      setVoiceStatusMsg("Processing...");
    }
  }, [voiceState]);

  // Stop any voice activity on unmount
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      pauseListening(false);
      stopSpeaking();
    };
  }, [pauseListening, stopSpeaking]);

  // When step changes to mode, halt audio
  useEffect(() => {
    if (step === 'mode') {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      isTimeoutRef.current = true;
      pauseListening(false);
      stopSpeaking();
      setVoiceStatusMsg('');
    }
  }, [step, pauseListening, stopSpeaking]);

  // When entering language step in voice mode, trigger voice language selection
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
      fetchLocationAndSetLanguage();
      setLoading(false);
    }
  }, [status, session, router]);

  const fetchLocationAndSetLanguage = () => {
    if (!navigator.geolocation) {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
          if (response.ok) {
            const data = await response.json();
            const region = data.principalSubdivision ? data.principalSubdivision.toLowerCase() : '';
            const langCode = STATE_LANGUAGE_MAP[region] || 'en';
            
            const recommended = LANGUAGES.find(l => l.code === langCode) || LANGUAGES[0];
            const others = LANGUAGES.filter(l => l.code !== recommended.code);
            
            setRecommendedLang(recommended);
            setOtherLangs(others);
          }
        } catch (error) {
          console.error("Error with reverse geocoding:", error);
        }
      },
      (error) => {
        console.warn("Geolocation error:", error);
      },
      { timeout: 10000 }
    );
  };

  const handleLanguageSelect = async (languageName) => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    try {
      const currentStorage = JSON.parse(localStorage.getItem('navigation-storage') || '{}');
      localStorage.setItem('navigation-storage', JSON.stringify({
        ...currentStorage,
        state: { ...(currentStorage.state || {}), language: languageName }
      }));
    } catch (err) {}

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
      await playSystemAudio('ask_language'); // Plays our pre-saved English, Kannada, Hindi audio
    } catch (err) {
      console.warn("Could not play ask_language, trying TTS directly...", err);
      await speak("Please choose your language. Which language do you speak? ನೀವು ಯಾವ ಭಾಷೆಯನ್ನು ಮಾತನಾಡುತ್ತೀರಿ? आप कौन सी भाषा बोलते हैं?");
    }

    setVoiceStatusMsg("Listening... (Tell me your language)");

    // 7s silence safety timer
    silenceTimerRef.current = setTimeout(async () => {
      isTimeoutRef.current = true;
      pauseListening(false);
      setVoiceStatusMsg("Are you still there?");
      try {
        await playSystemAudio('are_you_there');
      } catch (e) {
        await speak("Are you still there? Please tell me which language you speak.");
      }
      setTimeout(() => startVoiceLanguageSelection(), 400);
    }, 7000);

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
      <div className="min-h-screen bg-[#fcf9f8] flex items-center justify-center p-4">
        <p className="text-xl text-[#003441] font-medium animate-pulse">Please wait...</p>
      </div>
    );
  }

  if (step === 'mode') {
    return (
      <main className="min-h-screen bg-[#fcf9f8] flex flex-col items-center justify-center p-6 md:p-12 relative">
        <Button 
          variant="ghost" 
          onClick={() => signOut({ callbackUrl: '/' })}
          className="absolute top-4 right-4 md:top-6 md:right-6 text-slate-500 hover:text-slate-800 font-medium z-10"
        >
          Log Out
        </Button>
        <div className="w-full max-w-[800px] text-center mb-16 mt-8 flex flex-col items-center">
          <img 
            src="/logo.png" 
            alt="Parallax Logo" 
            className="w-20 h-20 md:w-24 md:h-24 object-contain rounded-2xl shadow-md border border-slate-100 p-2 bg-white mb-6"
          />
          <h1 className="font-heading text-5xl md:text-6xl text-[#003441] tracking-tight font-bold mb-4">
            Welcome to Parallax!
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground">
            How would you like to interact today?
          </p>
        </div>

        <div className="w-full max-w-[900px] flex flex-col md:flex-row items-center gap-8 justify-center">
          <Button 
            onClick={() => selectMode('text')}
            className="w-full md:w-1/2 h-[220px] rounded-3xl bg-white border-4 border-slate-200 hover:border-[#003441] flex flex-col items-center justify-center shadow-lg transition-all group"
            variant="outline"
          >
            <span className="text-4xl text-[#003441] font-bold mb-4 group-hover:scale-105 transition-transform">
              Normal Mode
            </span>
            <span className="text-xl text-muted-foreground text-center px-4">
              Navigate with touch and screen
            </span>
          </Button>

          <Button 
            onClick={() => selectMode('voice')}
            className="w-full md:w-1/2 h-[220px] rounded-3xl bg-[#003441] text-white flex flex-col items-center justify-center shadow-xl hover:scale-105 transition-transform group"
          >
            <span className="text-4xl font-bold mb-4">
              No Touch Mode
            </span>
            <span className="text-xl opacity-80 text-center px-4">
              Navigate entirely by voice
            </span>
          </Button>
        </div>
      </main>
    );
  }

  if (step === 'language' && interactionMode === 'voice') {
    return (
      <main className="min-h-screen bg-[#fcf9f8] flex flex-col items-center justify-center p-6 md:p-12 pb-24 relative">
        <Button 
          variant="ghost" 
          onClick={() => signOut({ callbackUrl: '/' })}
          className="absolute top-4 right-4 md:top-6 md:right-6 text-slate-500 hover:text-slate-800 font-medium z-10"
        >
          Log Out
        </Button>
        <div className="w-full max-w-[800px] text-center space-y-8">
          <div className="w-32 h-32 md:w-48 md:h-48 rounded-full bg-[#003441] text-white flex items-center justify-center mx-auto mb-8 animate-pulse shadow-2xl">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="22"/>
            </svg>
          </div>
          <h1 className="font-heading text-4xl md:text-5xl text-[#003441] tracking-tight font-bold">
            {voiceStatusMsg}
          </h1>
          <p className="text-xl text-muted-foreground">
            Please speak your language (English, Hindi, Kannada, etc.)
          </p>
          <div className="pt-4 pb-8">
            <div className="flex flex-wrap justify-center gap-3 max-w-[600px] mx-auto">
              {LANGUAGES.map(lang => (
                <div key={lang.code} className="px-4 py-2 bg-white rounded-full border border-slate-200 shadow-sm text-slate-600 font-medium text-sm md:text-base">
                  {lang.native} ({lang.name})
                </div>
              ))}
            </div>
          </div>
          <div className="pt-4">
            <Button onClick={handleBackToMode} variant="outline" className="text-[#003441] border-[#003441]">
              Back to Mode Selection
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // Visual Language Selection
  return (
    <main className="min-h-screen bg-[#fcf9f8] flex flex-col items-center justify-center p-6 md:p-12 pb-24 relative">
      <Button 
        variant="ghost" 
        onClick={() => signOut({ callbackUrl: '/' })}
        className="absolute top-4 right-4 md:top-6 md:right-6 text-slate-500 hover:text-slate-800 font-medium z-10"
      >
        Log Out
      </Button>
      <div className="w-full max-w-[800px] text-center mb-12 mt-8">
        <h1 className="font-heading text-5xl md:text-6xl text-[#003441] tracking-tight font-bold mb-4">
          Choose Your Language
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground">
          We will use this language to guide you.
        </p>
      </div>

      <div className="w-full max-w-[900px] flex flex-col items-center space-y-16">
        
        {/* Recommended Language */}
        <div className="w-full flex flex-col items-center">
          <p className="text-md font-bold text-[#003441] uppercase tracking-wider mb-6">
            Recommended for you
          </p>
          <Button
            onClick={() => handleLanguageSelect(recommendedLang.name)}
            className="w-full max-w-[500px] h-[160px] rounded-3xl bg-white border-4 border-transparent hover:border-[#003441] flex flex-col items-center justify-center shadow-lg transition-all group"
          >
            <span className="text-6xl md:text-7xl text-[#003441] font-bold mb-3 group-hover:scale-105 transition-transform">
              {recommendedLang.native}
            </span>
            <span className="text-2xl text-muted-foreground group-hover:text-[#003441] transition-colors">
              {recommendedLang.name}
            </span>
          </Button>
        </div>

        {/* Other Languages */}
        <div className="w-full flex flex-col items-center">
          <p className="text-md font-bold text-muted-foreground uppercase tracking-wider mb-6">
            Other Languages
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 w-full">
            {otherLangs.map((lang) => (
              <Button
                key={lang.code}
                variant="outline"
                onClick={() => handleLanguageSelect(lang.name)}
                className="h-[100px] rounded-2xl bg-white border-2 border-slate-200 hover:border-[#003441] hover:bg-slate-50 flex flex-col items-center justify-center shadow-md transition-all group"
              >
                <span className="text-3xl text-[#003441] font-bold mb-1 group-hover:scale-110 transition-transform">
                  {lang.native}
                </span>
                <span className="text-lg text-muted-foreground group-hover:text-[#003441] transition-colors">
                  {lang.name}
                </span>
              </Button>
            ))}
          </div>
        </div>

        <div className="pt-12">
          <Button onClick={handleBackToMode} variant="ghost" className="text-muted-foreground hover:text-[#003441]">
            Go Back
          </Button>
        </div>

      </div>
    </main>
  );
}
