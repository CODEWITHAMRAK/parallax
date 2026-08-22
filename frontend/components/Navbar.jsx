"use client";

import React, { useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { Button } from './ui/button';
import useNavigationStore from '../store/useNavigationStore';
import useLocalizationStore from '../store/useLocalizationStore';
import { useVoiceStore } from '../hooks/useVoice';
import { updateUserLanguage, getUserProfile } from '../lib/apiService';

import Link from 'next/link';
import { Home, Mic, MousePointer, Globe, LogOut } from 'lucide-react';

export default function Navbar() {
  const { data: session, status } = useSession();
  const language = useNavigationStore((state) => state.language);
  const setLanguage = useNavigationStore((state) => state.setLanguage);
  const { interactionMode, setInteractionMode } = useVoiceStore();

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
      const currentStorage = JSON.parse(localStorage.getItem('navigation-storage') || '{}');
      localStorage.setItem('navigation-storage', JSON.stringify({
        ...currentStorage,
        state: { ...(currentStorage.state || {}), language: newLang }
      }));
    } catch (err) {}

    try {
      await updateUserLanguage(newLang);
      await useLocalizationStore.getState().fetchDictionary(newLang);
    } catch (err) {
      console.error("Failed to sync language to backend:", err);
    }
    
    window.location.reload();
  };

  const handleModeChange = (newMode) => {
    if (newMode !== interactionMode) {
      setInteractionMode(newMode);
      try {
        const currentStorage = JSON.parse(localStorage.getItem('voice-mode-storage') || '{}');
        localStorage.setItem('voice-mode-storage', JSON.stringify({
          ...currentStorage,
          state: { ...(currentStorage.state || {}), interactionMode: newMode }
        }));
      } catch (e) {
        console.error("Failed to save mode to localStorage:", e);
      }
      window.location.reload();
    }
  };

  return (
    <nav className="w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-2 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-y-2 z-50 sticky top-0 shadow-sm">
      {/* Brand & Home */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <Link href="/home" className="flex items-center gap-1.5 sm:gap-2 hover:opacity-90 transition-opacity">
          <img 
            src="/logo.png" 
            alt="Parallax Logo" 
            className="w-6 h-6 sm:w-8 sm:h-8 object-contain rounded-lg shadow-sm border border-slate-100 p-0.5 bg-white" 
          />
          <span className="font-heading text-base sm:text-2xl font-bold text-[#003441] tracking-tight">
            Parallax
          </span>
        </Link>
        <Link 
          href="/home" 
          className="text-[10px] sm:text-sm font-semibold text-slate-600 hover:text-[#003441] px-1.5 sm:px-2 py-1 rounded-lg hover:bg-slate-100 flex items-center gap-1 transition-colors"
          title="Return to Home"
        >
          <Home className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="hidden md:inline-block">Home</span>
        </Link>
      </div>
      
      {/* Action Controls */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Tactile Segmented Mode Toggle */}
        <div 
          className="inline-flex items-center p-0.5 sm:p-1 bg-slate-100/90 rounded-full border border-slate-200/90 shadow-inner shrink-0"
          role="group"
          aria-label="Select interaction mode"
        >
          <button
            type="button"
            onClick={() => handleModeChange('voice')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold rounded-full transition-all duration-150 ${
              interactionMode === 'voice'
                ? 'bg-[#003441] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            title="No-Touch Mode (Voice Navigation)"
          >
            <Mic className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${interactionMode === 'voice' ? 'text-emerald-300' : 'text-slate-400'}`} />
            <span className="hidden xs:inline">No-Touch</span>
          </button>
          
          <button
            type="button"
            onClick={() => handleModeChange('text')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold rounded-full transition-all duration-150 ${
              interactionMode === 'text'
                ? 'bg-[#003441] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Normal Mode (Standard Touch & Typing)"
          >
            <MousePointer className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${interactionMode === 'text' ? 'text-slate-200' : 'text-slate-400'}`} />
            <span className="hidden xs:inline">Normal</span>
          </button>
        </div>

        {/* Intuitive Language Selector with Globe */}
        <div className="relative flex items-center shrink-0">
          <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none hidden sm:block" />
          <select 
            value={language}
            onChange={handleLanguageChange}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-[10px] sm:text-sm font-semibold rounded-full sm:pl-7 pr-2.5 py-1 sm:py-1.5 focus:outline-none focus:ring-2 focus:ring-[#003441] focus:border-transparent cursor-pointer hover:border-slate-300 transition-colors max-w-[80px] sm:max-w-[140px] truncate"
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
        </div>

        {/* User Account / Sign Out */}
        {session?.user && (
          <div className="flex items-center gap-1 sm:gap-2 border-l border-slate-200 pl-1.5 sm:pl-3 shrink-0">
            <span className="text-xs font-semibold text-slate-600 hidden lg:inline-block max-w-[100px] truncate">
              {session.user.name}
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => signOut({ callbackUrl: '/' })}
              className="h-7 sm:h-8 px-1.5 sm:px-2.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline-block text-xs font-semibold ml-1">Exit</span>
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
}
