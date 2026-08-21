"use client";

import React, { useState, useEffect, useRef } from "react";
import useNavigationStore from "../store/useNavigationStore.js";
import useFormStore from "../store/useFormStore.js";
import { fetchChatAction } from "../lib/apiService.js";
import { executeAction } from "../lib/actionDispatcher.js";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button.jsx";
import { useVoice, VoiceState } from "../hooks/useVoice.js";

// Simple inline SVG icons to avoid dependency issues
const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" x2="12" y1="19" y2="22"/>
  </svg>
);

const StopIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="6" width="12" height="12" rx="2" ry="2"/>
  </svg>
);

export default function TextNavigationUI() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { systemMessage, currentStepIndex, currentFieldId, currentPage } = useNavigationStore();
  const { schema, values } = useFormStore();
  const router = useRouter();

  const { state: voiceState, errorMsg: voiceError, language, setLanguage, startListening, stopListeningAndTranscribe, speak, stopSpeaking } = useVoice();
  
  const lastMessageRef = useRef(systemMessage);

  useEffect(() => {
    // Only trigger TTS when the system message changes, and it's not a loading state
    if (systemMessage && systemMessage !== lastMessageRef.current && !loading && !systemMessage.includes("Thinking") && !systemMessage.includes("Getting things ready")) {
      lastMessageRef.current = systemMessage;
      speak(systemMessage);
    }
  }, [systemMessage, loading, speak]);

  const processInput = async (textToProcess) => {
    if (!textToProcess.trim()) return;
    
    useNavigationStore.getState().addMessageToHistory(currentStepIndex, "user", textToProcess);
    setLoading(true);
    
    try {
      const currentStep = schema ? schema.steps[currentStepIndex] : null;
      const currentField = currentStep ? currentStep.fields.find(f => f.id === currentFieldId) : null;
      
      const context = {
        chat_history: useNavigationStore.getState().stepHistory[currentStepIndex] || [],
        current_page: currentPage,
        form_title: schema?.title,
        current_step: currentStep ? { id: currentStep.id, title: currentStep.title, fields: currentStep.fields } : null,
        current_field: currentField ? { id: currentField.id, label: currentField.label, type: currentField.type } : null,
        form_values: values,
        available_steps: schema ? schema.steps.map(s => s.id) : []
      };

      const action = await fetchChatAction(textToProcess, context);
      executeAction(action, router);
      setInput("");
    } catch (error) {
      console.error(error);
      useNavigationStore.getState().setSystemMessage("Sorry, I'm having trouble connecting right now.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await processInput(input);
  };

  const handleVoiceAction = async () => {
    if (voiceState === VoiceState.LISTENING) {
      const transcribed = await stopListeningAndTranscribe();
      if (transcribed) {
        setInput(transcribed);
        await processInput(transcribed);
      }
    } else if (voiceState === VoiceState.SPEAKING) {
      stopSpeaking();
    } else {
      startListening();
    }
  };

  const isListening = voiceState === VoiceState.LISTENING;
  const isProcessing = voiceState === VoiceState.PROCESSING;
  const isSpeaking = voiceState === VoiceState.SPEAKING;
  const disableVoice = isProcessing || loading;

  return (
    <div className="fixed bottom-0 left-0 w-full bg-background border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50">
      <div className="max-w-[800px] mx-auto p-4 md:p-6 flex flex-col gap-4">
        
        {/* Top Controls: Language & Voice Error */}
        <div className="flex justify-between items-center text-sm">
          {voiceError && <span className="text-error font-medium">{voiceError}</span>}
          {!voiceError && (
             <span className="text-muted-foreground">
               {isListening ? "🎙 Listening..." : isProcessing ? "Processing..." : isSpeaking ? "🔊 Speaking..." : "Tap the microphone to speak."}
             </span>
          )}
          <select 
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-transparent text-foreground border border-border rounded-md px-2 py-1 outline-none focus:border-primary"
          >
            <option value="en-IN">English (India)</option>
            <option value="hi-IN">Hindi</option>
            <option value="kn-IN">Kannada</option>
          </select>
        </div>

        {/* System Message */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-xl">LA</span>
          </div>
          <div className="flex-1 bg-muted rounded-2xl p-4 md:p-5 rounded-tl-sm text-foreground text-xl font-medium">
            {loading ? (
              <span className="animate-pulse">Thinking...</span>
            ) : systemMessage ? (
              systemMessage
            ) : (
              <span className="animate-pulse">Getting things ready...</span>
            )}
          </div>
        </div>

        {/* Voice & Text Input */}
        <div className="flex flex-col md:flex-row gap-4 items-center mt-2">
          
          {/* Prominent Voice Button */}
          <button 
            onClick={handleVoiceAction}
            disabled={disableVoice}
            className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center transition-all shadow-md shrink-0 
              ${isListening ? 'bg-primary text-primary-foreground animate-pulse' : 
                isSpeaking ? 'bg-secondary text-secondary-foreground' : 
                'bg-primary text-primary-foreground hover:scale-105'
              } 
              ${disableVoice ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            aria-label={isListening ? "Stop Listening" : isSpeaking ? "Stop Speaking" : "Start Voice Input"}
          >
            {isListening || isSpeaking ? <StopIcon /> : <MicIcon />}
          </button>

          {/* Text Input (Secondary) */}
          <form onSubmit={handleSubmit} className="flex gap-2 w-full md:flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Or type your response..."
              className="flex-1 h-[60px] rounded-full px-6 bg-input text-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 border-2 border-border focus:border-primary transition-all shadow-sm"
            />
            <Button 
              type="submit" 
              disabled={loading || !input.trim()}
              className="h-[60px] px-6 rounded-full bg-secondary text-secondary-foreground font-bold hover:bg-secondary/90 text-lg"
            >
              Send
            </Button>
          </form>
        </div>
        
      </div>
    </div>
  );
}
