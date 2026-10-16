"use client";

import React from 'react';
import Navbar from '@/components/Navbar';
import LanguageLoadingOverlay from '@/components/LanguageLoadingOverlay';

export default function AppLayout({ children }) {
  return (
    <div className="flex flex-col min-h-screen relative">
      <LanguageLoadingOverlay />
      <Navbar />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
