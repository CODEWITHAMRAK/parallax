"use client";

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, Mic, ShieldCheck, Zap } from 'lucide-react';

export default function LandingPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/onboarding');
    }
  }, [status, router]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fcf9f8] flex flex-col items-center justify-center p-4 selection:bg-[#003441] selection:text-white">
      {/* Aurora Background Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[80vw] h-[80vh] rounded-full bg-gradient-to-br from-[#0f4c5c]/20 to-[#003441]/10 blur-[120px] pointer-events-none animate-pulse duration-10000" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vh] rounded-full bg-gradient-to-tl from-[#9acee1]/30 to-transparent blur-[150px] pointer-events-none" />
      <div className="absolute top-[20%] right-[10%] w-[50vw] h-[50vh] rounded-full bg-[#003441]/10 blur-[100px] pointer-events-none animate-pulse duration-[15000ms]" />

      <div className="relative z-10 max-w-5xl w-full flex flex-col items-center">
        
        {/* Main Content Area (No Card) */}
        <div className="w-full flex flex-col items-center justify-center space-y-12 text-center transition-all duration-500 py-10 md:py-16">
          
          {/* Logo & Badge */}
          <div className="flex flex-col items-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="relative group">
              <div className="absolute -inset-1"></div>
              <img 
                src="/logo-no-bg.png" 
                alt="Parallax Logo" 
                className="relative w-24 h-24 md:w-32 md:h-32 object-contain transition-transform duration-500 group-hover:scale-105 drop-shadow-md"
              />
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#003441]/5 border border-[#003441]/10 text-[#003441] text-sm font-medium">
              <Sparkles className="w-4 h-4 text-[#0f4c5c]" />
              <span>Accessibility First Services</span>
            </div>
          </div>

          {/* Typography */}
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-150">
            <h1 className="font-heading text-5xl md:text-7xl lg:text-8xl tracking-tighter font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-[#003441] via-[#0f4c5c] to-[#306576]">
              Parallax
            </h1>
            <p className="text-lg md:text-2xl text-[#605e55] max-w-[700px] mx-auto font-medium leading-relaxed">
              Complete digital services your way. Choose how you want to interact and let our voice-guided AI assist you seamlessly.
            </p>
          </div>
          
          {/* Action Area */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mt-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 w-full sm:w-auto">
            <Button 
              onClick={() => signIn('google', { callbackUrl: '/onboarding' })}
              className="group relative h-20 px-14 rounded-2xl bg-[#003441] hover:bg-[#0f4c5c] text-white text-2xl font-semibold overflow-hidden transition-all duration-300 hover:-translate-y-1 w-full sm:w-auto"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              <span className="flex items-center gap-3 relative z-10">
                Explore Services
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </span>
            </Button>
          </div>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20 w-full px-4 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-500">
          {[
            { icon: <Mic className="w-10 h-10 text-[#003441]" />, title: "Voice Guided", desc: "Interact entirely through speech." },
            { icon: <Sparkles className="w-10 h-10 text-[#003441]" />, title: "Smart Autofill", desc: "Scan documents for instant data entry." },
            { icon: <ShieldCheck className="w-10 h-10 text-[#003441]" />, title: "Accessible", desc: "Designed for all cognitive & motor needs." }
          ].map((feat, i) => (
            <div key={i} className="flex flex-col items-center text-center p-10 rounded-[2rem] bg-white/50 backdrop-blur-sm border-2 border-[#003441]/10 hover:border-[#003441]/30 transition-colors">
              <div className="p-5 bg-[#9acee1]/20 rounded-full mb-6">
                {feat.icon}
              </div>
              <h3 className="text-2xl font-bold text-[#003441] mb-3">{feat.title}</h3>
              <p className="text-lg text-[#605e55] font-medium leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>

      </div>

      {/* Footer */}
      <footer className="w-full text-center pt-20 pb-4 relative z-10 text-[#605e55]/80 text-sm font-medium animate-in fade-in duration-1000 delay-700">
        <p>&copy; {new Date().getFullYear()} Parallax. All rights reserved.</p>
      </footer>
    </main>
  );
}
