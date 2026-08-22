"use client";

import React from 'react';
import Navbar from '@/components/Navbar';

export default function FormLayout({ children }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
