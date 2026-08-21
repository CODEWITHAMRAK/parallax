"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useNavigationStore from '@/store/useNavigationStore';
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
  
  const [recommendedLang, setRecommendedLang] = useState(LANGUAGES[0]);
  const [otherLangs, setOtherLangs] = useState(LANGUAGES.slice(1));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/api/auth/signin?callbackUrl=/language");
      return;
    }

    if (status === "authenticated") {
      fetchLocationAndSetLanguage();
    }
  }, [status, router]);

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
      router.push('/');
    } catch (error) {
      console.error("Failed to save language:", error);
      // Fallback: still navigate if backend fails, for smooth UX
      setStoreLanguage(languageName);
      router.push('/');
    }
  };

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-[#fcf9f8] flex items-center justify-center p-4">
        <p className="text-xl text-[#003441] font-medium animate-pulse">Please wait...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#fcf9f8] flex flex-col items-center p-6 md:p-12">
      <div className="w-full max-w-[800px] text-center mb-12 mt-8">
        <h1 className="font-heading text-4xl md:text-5xl text-[#003441] tracking-tight font-bold mb-4">
          Choose Your Language
        </h1>
        <p className="text-xl text-muted-foreground">
          We will use this language to guide you.
        </p>
      </div>

      <div className="w-full max-w-[800px] flex flex-col items-center space-y-12">
        
        {/* Recommended Language */}
        <div className="w-full flex flex-col items-center">
          <p className="text-sm font-semibold text-[#003441] uppercase tracking-wider mb-6">
            Recommended for you
          </p>
          <Button
            onClick={() => handleLanguageSelect(recommendedLang.name)}
            className="w-full max-w-[400px] h-[120px] rounded-2xl bg-white border-2 border-transparent hover:border-[#003441] flex flex-col items-center justify-center shadow-md transition-all group"
          >
            <span className="text-4xl text-[#003441] font-bold mb-2 group-hover:scale-105 transition-transform">
              {recommendedLang.native}
            </span>
            <span className="text-lg text-muted-foreground group-hover:text-[#003441] transition-colors">
              {recommendedLang.name}
            </span>
          </Button>
        </div>

        {/* Other Languages */}
        <div className="w-full flex flex-col items-center">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6">
            Other Languages
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full">
            {otherLangs.map((lang) => (
              <Button
                key={lang.code}
                variant="outline"
                onClick={() => handleLanguageSelect(lang.name)}
                className="h-[80px] rounded-xl bg-white border-slate-200 hover:border-[#003441] hover:bg-slate-50 flex flex-col items-center justify-center shadow-sm"
              >
                <span className="text-2xl text-[#003441] font-medium mb-1">
                  {lang.native}
                </span>
                <span className="text-sm text-muted-foreground">
                  {lang.name}
                </span>
              </Button>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
