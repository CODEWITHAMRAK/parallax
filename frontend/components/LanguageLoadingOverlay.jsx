"use strict";
"use client";

import React from 'react';
import useLocalizationStore from '@/store/useLocalizationStore';
import { Loader2 } from 'lucide-react';

export default function LanguageLoadingOverlay() {
  const loading = useLocalizationStore((state) => state.loading);

  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/50 backdrop-blur-sm transition-all duration-300">
      <div className="flex flex-col items-center justify-center p-6 bg-card rounded-2xl shadow-xl border border-border">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-lg font-bold text-foreground">Loading Language...</p>
      </div>
    </div>
  );
}
