"use client";

import React, { useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { Button } from './ui/button';
import useNavigationStore from '../store/useNavigationStore';
import useLocalizationStore, { useTranslation } from '../store/useLocalizationStore';
import { useVoiceStore } from '../hooks/useVoice';
import { updateUserLanguage, getUserProfile } from '../lib/apiService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import Link from 'next/link';
import { Home, Mic, MousePointer, Globe, LogOut } from 'lucide-react';

export default function Navbar() {
  const { data: session, status } = useSession();
  const language = useNavigationStore((state) => state.language);
  const setLanguage = useNavigationStore((state) => state.setLanguage);
  const { interactionMode, setInteractionMode } = useVoiceStore();
  const t = useTranslation();

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
    <nav className="w-full border-b border-border bg-background px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-y-4 z-50 sticky top-0 shadow-sm">
      {/* Brand & Home */}
      <div className="flex items-center gap-4 shrink-0">
        <Link href="/home" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 rounded-lg border border-border bg-card flex items-center justify-center shadow-sm">
            <img 
              src="/logo.png" 
              alt="Parallax Logo" 
              className="w-6 h-6 object-contain" 
            />
          </div>
          <span className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
            Parallax
          </span>
        </Link>
        <div className="hidden sm:block h-6 w-[1px] bg-border mx-2"></div>
        <Link 
          href="/home" 
          className="text-xs sm:text-sm font-bold font-mono text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted flex items-center gap-2 transition-colors border border-transparent hover:border-border"
          title="Return to Home"
        >
          <Home className="w-4 h-4" />
          <span className="hidden md:inline-block">{t('Home')}</span>
        </Link>
      </div>
      
      {/* Action Controls */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        
        {/* Tactile Segmented Mode Toggle */}
        <div 
          className="inline-flex items-center p-1 bg-surface-dim rounded-lg border border-border shadow-sm shrink-0"
          role="group"
          aria-label="Select interaction mode"
        >
          <button
            type="button"
            onClick={() => handleModeChange('voice')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 ${
              interactionMode === 'voice'
                ? 'bg-primary text-primary-foreground border-transparent'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            title="No-Touch Mode (Voice Navigation)"
          >
            <Mic className="w-4 h-4" />
            <span className="hidden xs:inline">{t('voice_mode')}</span>
          </button>
          
          <button
            type="button"
            onClick={() => handleModeChange('text')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 ${
              interactionMode === 'text'
                ? 'bg-primary text-primary-foreground border-transparent'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            title="Normal Mode (Standard Touch & Typing)"
          >
            <MousePointer className="w-4 h-4" />
            <span className="hidden xs:inline">{t('normal_mode')}</span>
          </button>
        </div>

        {/* Intuitive Language Selector with Globe */}
        <div className="flex items-center shrink-0">
          <Select value={language || "English"} onValueChange={(val) => handleLanguageChange({ target: { value: val }})}>
            <SelectTrigger className="w-[120px] sm:w-[170px] bg-card border-border font-bold text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground hidden sm:block shrink-0" />
                <SelectValue placeholder="Language" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="English">English</SelectItem>
              <SelectItem value="Hindi">हिन्दी (Hindi)</SelectItem>
              <SelectItem value="Bengali">বাংলা (Bengali)</SelectItem>
              <SelectItem value="Gujarati">ગુજરાતી (Gujarati)</SelectItem>
              <SelectItem value="Kannada">ಕನ್ನಡ (Kannada)</SelectItem>
              <SelectItem value="Malayalam">മലയാളം (Malayalam)</SelectItem>
              <SelectItem value="Marathi">मराठी (Marathi)</SelectItem>
              <SelectItem value="Odia">ଓଡ଼ିଆ (Odia)</SelectItem>
              <SelectItem value="Punjabi">ਪੰਜਾਬੀ (Punjabi)</SelectItem>
              <SelectItem value="Tamil">தமிழ் (Tamil)</SelectItem>
              <SelectItem value="Telugu">తెలుగు (Telugu)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* User Account / Sign Out */}
        {session?.user && (
          <div className="flex items-center border-l border-border pl-4 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold text-lg hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                {session.user.name.charAt(0).toUpperCase()}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 mt-2 p-2 rounded-lg border-border bg-card shadow-lg">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex flex-col space-y-1">
                    <span className="text-sm font-bold text-foreground">{session.user.name}</span>
                    <span className="text-xs font-mono text-muted-foreground truncate">{session.user.email}</span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-border my-2" />
                <DropdownMenuItem 
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer rounded-md font-bold p-3"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t('sign_out')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </nav>
  );
}
