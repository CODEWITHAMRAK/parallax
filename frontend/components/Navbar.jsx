"use client";

import React from 'react';
import { signOut, useSession } from 'next-auth/react';
import { Button } from './ui/button';

export default function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="w-full border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between z-50">
      <div className="flex items-center gap-2">
        <span className="font-heading text-2xl font-bold text-[#003441] tracking-tight">
          Parallax
        </span>
      </div>
      
      <div className="flex items-center gap-4">
        {session?.user && (
          <div className="flex items-center gap-4">
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
