"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useNavigationStore from '@/store/useNavigationStore';
import useLocalizationStore from '@/store/useLocalizationStore';
import { useVoiceStore } from '@/hooks/useVoice';
import { updateUserLanguage } from '@/lib/apiService';
import { Button } from '@/components/ui/button';

const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' }
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
  const setInteractionMode = useVoiceStore((state) => state.setInteractionMode);
  
  const [recommendedLang, setRecommendedLang] = useState(LANGUAGES[0]);
  const [otherLangs, setOtherLangs] = useState(LANGUAGES.slice(1));
  const [loading, setLoading] = useState(true);
  const [showModeSelection, setShowModeSelection] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/api/auth/signin?callbackUrl=/onboarding");
      return;
    }

    if (status === "authenticated") {
      if (session?.user?.preferredLanguage) {
        const preferredLang = session.user.preferredLanguage;
        setStoreLanguage(preferredLang);
        useLocalizationStore.getState().fetchDictionary(preferredLang).then(() => {
          setShowModeSelection(true);
          setLoading(false);
        });
      } else {
        fetchLocationAndSetLanguage();
      }
    }
  }, [status, session, router, setStoreLanguage]);

  const fetchLocationAndSetLanguage = () => {
    if (!navigator.geolocation) {
      console.warn("Geolocation is not supported by this browser.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          // Use BigDataCloud's free client-side reverse geocoding API
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
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.warn("Geolocation error (user might have denied):", error);
        setLoading(false); // Fallback to English defaults
      },
      { timeout: 10000 }
    );
  };

  const handleLanguageSelect = async (languageName) => {
    try {
      await updateUserLanguage(languageName);
      setStoreLanguage(languageName);
      
      // Fetch localized dictionary for the chosen language
      await useLocalizationStore.getState().fetchDictionary(languageName);

      router.push('/home');
    } catch (error) {
      console.error("Failed to save language:", error);
      setStoreLanguage(languageName);
      useLocalizationStore.getState().fetchDictionary(languageName);
      router.push('/home');
    }
  };

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-[#fcf9f8] flex items-center justify-center p-4">
        <p className="text-xl text-[#003441] font-medium animate-pulse">Please wait...</p>
      </div>
    );
  }

  if (showModeSelection) {
    return (
      <main className="min-h-screen bg-[#fcf9f8] flex flex-col items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-[800px] text-center mb-16 mt-8">
          <h1 className="font-heading text-5xl md:text-6xl text-[#003441] tracking-tight font-bold mb-4">
            Welcome back!
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground">
            How would you like to use Parallax today?
          </p>
        </div>

        <div className="w-full max-w-[900px] flex flex-col md:flex-row items-center gap-8 justify-center">
          <Button 
            onClick={() => {
              setInteractionMode('text');
              router.push('/home');
            }}
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
            onClick={() => {
              setInteractionMode('voice');
              router.push('/home');
            }}
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

  return (
    <main className="min-h-screen bg-[#fcf9f8] flex flex-col items-center justify-center p-6 md:p-12 pb-24 relative">
      
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

        {/* Big No Touch Mode Button */}
        <div className="w-full pt-12 mt-12 border-t border-slate-200 flex flex-col items-center">
          <p className="text-xl md:text-2xl font-medium text-muted-foreground mb-6 text-center">
            Or, if you prefer to navigate entirely with your voice:
          </p>
          <Button 
            onClick={() => {
              setInteractionMode('voice');
              router.push('/home');
            }}
            className="w-full max-w-[600px] h-[120px] rounded-3xl bg-[#003441] text-white flex flex-col items-center justify-center shadow-xl hover:scale-105 transition-transform group"
          >
            <span className="text-4xl md:text-5xl font-bold mb-2">
              Start No Touch Mode
            </span>
            <span className="text-xl opacity-80 font-medium">
              We will guide you by voice
            </span>
          </Button>
        </div>

      </div>
    </main>
  );
}
