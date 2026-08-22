"use client";

import React from 'react';
import { signOut, useSession } from 'next-auth/react';
import { Button } from './ui/button';
import useNavigationStore from '../store/useNavigationStore';

export default function Navbar() {
  const { data: session } = useSession();
  const language = useNavigationStore((state) => state.language);
  const setLanguage = useNavigationStore((state) => state.setLanguage);

  return (
    <nav className="w-full border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between z-50">
      <div className="flex items-center gap-2">
        <span className="font-heading text-2xl font-bold text-[#003441] tracking-tight">
          Parallax
        </span>
      </div>
      
      <div className="flex items-center gap-4">
        <select 
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#003441] focus:border-transparent cursor-pointer hover:border-slate-300 transition-colors"
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
