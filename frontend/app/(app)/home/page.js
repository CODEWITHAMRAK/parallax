"use client";

import React, { useEffect, useRef, useState } from 'react';
import TextNavigationUI from '@/components/TextNavigationUI.jsx';
import useNavigationStore from '@/store/useNavigationStore.js';
import useLocalizationStore from '@/store/useLocalizationStore.js';
import { useVoiceStore, useVoice } from '@/hooks/useVoice.js';
import { useRouter } from 'next/navigation';
import { GraduationCap, Landmark, Bus, FileText, Volume2 } from 'lucide-react';
import { fetchAllSchemas } from '@/lib/apiService.js';
import { apiFetch } from '@/lib/api.js';

// Color and icon mapping for specific forms to aid cognitive inclusivity
const getFormStyling = (formId) => {
  switch (formId) {
    case 'national_scholarship':
      return { color: 'bg-emerald-100 hover:bg-emerald-200 border-emerald-300 text-emerald-900', icon: GraduationCap };
    case 'education_loan':
      return { color: 'bg-purple-100 hover:bg-purple-200 border-purple-300 text-purple-900', icon: Landmark };
    case 'bus_pass':
      return { color: 'bg-blue-100 hover:bg-blue-200 border-blue-300 text-blue-900', icon: Bus };
    default:
      return { color: 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-900', icon: FileText };
  }
};

export default function HomePage() {
  const { setPage, setSystemMessage, language, setAvailableForms } = useNavigationStore();
  const { interactionMode } = useVoiceStore();
  const { playSystemAudio, pauseListening } = useVoice();
  const t = useLocalizationStore(state => state.t);
  const router = useRouter();

  const [forms, setForms] = useState([]);
  const [infos, setInfos] = useState([]);
  const [loading, setLoading] = useState(true);

  const isVoiceMode = interactionMode === 'voice';
  const hasGreetedRef = useRef(false);

  useEffect(() => {
    setPage('home');
    
    // Fetch available forms from backend
    const fetchData = async () => {
      try {
        const data = await fetchAllSchemas();
        setForms(data);
        const formTitles = (data || []).map(f => f.title);
        setAvailableForms(formTitles);

        const infoRes = await apiFetch("/api/information");
        if (infoRes.ok) {
            const infoData = await infoRes.json();
            setInfos(infoData);
        }

        if (isVoiceMode && !hasGreetedRef.current) {
          hasGreetedRef.current = true;
          pauseListening(false);
          
          if (language && language !== 'English') {
            await useLocalizationStore.getState().fetchDictionary(language);
          }
          
          let welcomeText = `Welcome to Parallax! You can apply for: ${formTitles.join(", ")}. Which one do you want to open?`;
          setSystemMessage(welcomeText);
  
          setTimeout(async () => {
            try {
              // Note: If you want this to be completely dynamic, you need TTS instead of pre-recorded audio.
              // Assuming LLM will take over if the user just asks "What can I do?"
              await playSystemAudio("welcome_home");
              window.dispatchEvent(new Event('start-voice-turn'));
            } catch (e) {
              if (e.message !== "INTERRUPTED") {
                console.warn("Autoplay prevented or audio failed:", e);
                window.dispatchEvent(new Event('start-voice-turn'));
              }
            }
          }, 100);
        } else if (!isVoiceMode) {
          setSystemMessage("");
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [setPage, setSystemMessage, isVoiceMode, language, playSystemAudio, setAvailableForms]);

  return (
    <main className={`min-h-screen bg-background flex flex-col items-center justify-start pt-6 md:pt-12 p-4 md:p-8 ${isVoiceMode ? 'pb-[380px] md:pb-[420px]' : 'pb-16'}`}>
      <div className="max-w-[1000px] w-full text-center space-y-6 flex flex-col items-center">
        <img 
          src="/logo.png" 
          alt="Parallax Logo" 
          className="w-16 h-16 md:w-24 md:h-24 object-contain rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 p-2 bg-white"
        />
        <h1 className="font-heading text-3xl md:text-5xl lg:text-6xl text-primary tracking-tight font-bold">
          Welcome to Parallax
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-[700px] mx-auto font-medium">
          An accessibility-first platform designed to help you access digital government services with ease.
        </p>
        
        {loading ? (
          <div className="mt-8 text-xl animate-pulse text-slate-400 font-bold">Loading available services...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full mt-6">
              {forms.map((form) => {
                const { color, icon: Icon } = getFormStyling(form.formId);
                return (
                  <button
                    key={form.formId}
                    onClick={() => {
                      if (isVoiceMode) {
                        setSystemMessage(`Opening the ${form.title}.`);
                      }
                      router.push(`/form/${form.formId}`);
                    }}
                    className={`flex flex-col items-center text-center p-6 md:p-8 rounded-[2rem] border-4 shadow-sm hover:shadow-md transition-all hover:scale-[1.03] active:scale-[0.98] focus:outline-none focus:ring-8 focus:ring-primary/20 ${color}`}
                    aria-label={`Open ${form.title}`}
                  >
                    <div className="w-16 h-16 md:w-20 md:h-20 shrink-0 bg-white/60 rounded-2xl flex items-center justify-center mb-4 shadow-xs">
                      <Icon className="w-9 h-9 md:w-11 md:h-11 opacity-90" />
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                      <h2 className="text-xl md:text-2xl font-bold leading-snug">
                        {form.title}
                      </h2>
                    </div>
                  </button>
                );
              })}
            </div>

            {infos.length > 0 && (
              <div className="w-full mt-12 text-left">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#003441] rounded-full flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  Information Board
                </h2>
                <div className="flex flex-col gap-4">
                  {infos.map((info, idx) => {
                    const title = info.title[language || "English"] || info.title["English"];
                    const content = info.content[language || "English"] || info.content["English"];
                    const audioUrl = info.audioUrls?.[language || "English"];

                    return (
                      <div key={idx} className="bg-white p-6 md:p-8 rounded-[1.5rem] border-4 border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                        <div className="flex-1">
                          <h3 className="text-xl md:text-2xl font-bold text-primary mb-2">{title}</h3>
                          <p className="text-lg text-slate-600 font-medium leading-relaxed">{content}</p>
                        </div>
                        {audioUrl && (
                          <button 
                            onClick={() => {
                              const audio = new Audio(`http://localhost:8080${audioUrl}`);
                              audio.play();
                            }}
                            className="shrink-0 bg-primary/10 hover:bg-primary/20 text-primary px-6 py-4 rounded-2xl font-bold text-lg flex items-center gap-2 transition-colors focus:ring-4 focus:ring-primary/30 outline-none"
                            aria-label={`Listen to ${title}`}
                          >
                            Listen <Volume2 className="w-6 h-6" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Voice & Assistant are ONLY rendered on Home Page in No-Touch Mode */}
      {isVoiceMode && <TextNavigationUI isHomeVoiceOnly={true} />}
    </main>
  );
}
