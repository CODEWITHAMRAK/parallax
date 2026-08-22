"use client";

import React, { useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { Button } from './ui/button';
import useNavigationStore from '../store/useNavigationStore';
import useLocalizationStore from '../store/useLocalizationStore';
import { updateUserLanguage, getUserProfile } from '../lib/apiService';

import Link from 'next/link';
import { Home } from 'lucide-react';

export default function Navbar() {
  const { data: session, status } = useSession();
  const language = useNavigationStore((state) => state.language);
  const setLanguage = useNavigationStore((state) => state.setLanguage);

  useEffect(() => {
    const syncProfileLanguage = async () => {
      if (status === 'authenticated') {
        try {
          const res = await getUserProfile();
          if (res?.data?.user?.preferredLanguage) {
            const dbLang = res.data.user.preferredLanguage;
            setLanguage(dbLang);
            useLocalizationStore.getState().fetchDictionary(dbLang);
            return;
          }
        } catch (e) {
          console.warn("Could not fetch user profile for language sync:", e);
        }
      }
      
      if (language) {
        useLocalizationStore.getState().fetchDictionary(language);
      }
    };
    
    syncProfileLanguage();
  }, [status, setLanguage]);

  const handleLanguageChange = async (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    try {
      await updateUserLanguage(newLang);
      await useLocalizationStore.getState().fetchDictionary(newLang);
    } catch (err) {
      console.error("Failed to sync language to backend:", err);
    }
  };

  return (
    <nav className="w-full border-b border-slate-200 bg-white px-4 md:px-6 py-3.5 flex flex-wrap items-center justify-between gap-y-3 z-50 sticky top-0 shadow-sm">
      <div className="flex items-center gap-2 md:gap-3">
        <Link href="/home" className="flex items-center gap-2.5 hover:opacity-85 transition-opacity">
          <img src="/logo.png" alt="Parallax Logo" className="w-8 h-8 object-contain rounded-md" />
          <span className="font-heading text-xl md:text-2xl font-bold text-[#003441] tracking-tight">
            Parallax
          </span>
        </Link>
        <Link 
          href="/home" 
          className="text-sm font-medium text-slate-600 hover:text-[#003441] px-2 md:px-2.5 py-1 rounded-md hover:bg-slate-100 flex items-center gap-1.5 transition-all"
        >
          <Home className="w-4 h-4" />
          <span className="hidden sm:inline-block">Home</span>
        </Link>
      </div>
      
      <div className="flex items-center gap-2 md:gap-4 w-full sm:w-auto justify-between sm:justify-end">
        <select 
          value={language}
          onChange={handleLanguageChange}
          className="bg-white border border-slate-200 text-slate-700 text-xs md:text-sm font-medium rounded-md px-2 md:px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#003441] focus:border-transparent cursor-pointer hover:border-slate-300 transition-colors max-w-[140px] sm:max-w-none truncate"
          aria-label="Select Language"
        >
          <option value="English">English</option>
          <option value="Hindi">हिन्दी (Hindi)</option>
          <option value="Bengali">বাংলা (Bengali)</option>
          <option value="Gujarati">ગુજરાતી (Gujarati)</option>
          <option value="Kannada">ಕನ್ನಡ (Kannada)</option>
          <option value="Malayalam">മലയാളം (Malayalam)</option>
          <option value="Marathi">मराठी (Marathi)</option>
          <option value="Odia">ଓଡ଼ିଆ (Odia)</option>
          <option value="Punjabi">ਪੰਜਾਬੀ (Punjabi)</option>
          <option value="Tamil">தமிழ் (Tamil)</option>
          <option value="Telugu">తెలుగు (Telugu)</option>
        </select>

        {session?.user && (
          <div className="flex items-center gap-4 border-l border-slate-200 pl-4">
            <span className="text-sm font-medium text-slate-600 hidden sm:inline-block">
              {session.user.name}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => signOut({ callbackUrl: '/' })}
              className="border-slate-200 text-slate-600 hover:text-[#003441] hover:border-[#003441]"
            >
              Sign Out
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
}
