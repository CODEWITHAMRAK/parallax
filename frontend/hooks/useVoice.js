import { create } from 'zustand';
import { useState, useCallback } from 'react';
import { voiceService } from '../lib/voiceService';

export const VoiceState = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  ERROR: 'error'
};

// Global state for interaction mode so it persists across pages/components
export const useVoiceStore = create((set) => ({
  interactionMode: 'text',
  setInteractionMode: (mode) => set({ interactionMode: mode }),
}));

export function useVoice() {
  const [state, setState] = useState(VoiceState.IDLE);
  const [transcribedText, setTranscribedText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const { interactionMode, setInteractionMode } = useVoiceStore();

  const startListening = useCallback(async (onSpeechEndCallback = null, onSpeechStart = null) => {
    try {
      voiceService.stopSpeaking(); 
      setErrorMsg('');
      setState(VoiceState.PREPARING);
      
      const handleSpeechEnd = async (audioBlob) => {
        setState(VoiceState.PROCESSING);
        voiceService.pauseListening();
        
        try {
          const text = await voiceService.transcribe(audioBlob);
          setTranscribedText(text);
          setState(VoiceState.IDLE);
          if (onSpeechEndCallback) onSpeechEndCallback(text);
        } catch (err) {
          console.error("[useVoice Debug] STT Exception:", err);
          setState(VoiceState.ERROR);
          setErrorMsg("I couldn't understand that. Please try again.");
          if (onSpeechEndCallback) onSpeechEndCallback(null);
        }
      };

      const handleSpeechStartInternal = () => {
        if (onSpeechStart) onSpeechStart();
      };
      
      await voiceService.startListening(handleSpeechStartInternal, handleSpeechEnd);
      setState(VoiceState.LISTENING);
    } catch (err) {
      console.error(err);
      setState(VoiceState.ERROR);
      setErrorMsg(err.message || 'Microphone access denied.');
    }
  }, []);

  const pauseListening = useCallback(() => {
    voiceService.pauseListening();
    setState(VoiceState.IDLE);
  }, []);

  const speak = useCallback(async (text) => {
    try {
      await voiceService.speak(text);
    } catch (err) {
      console.error('TTS Error:', err);
    }
  }, []);

  const playSystemAudio = useCallback(async (type) => {
    try {
      // Assuming hi-IN is default, can be dynamically linked to Language state later
      await voiceService.playSystemAudio(type, "hi-IN");
    } catch (err) {
      console.error('System Audio Error:', err);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    voiceService.stopSpeaking();
  }, []);

  return {
    state,
    transcribedText,
    errorMsg,
    startListening,
    pauseListening, // renamed from stopListeningAndTranscribe as it no longer fetches manually
    speak,
    playSystemAudio,
    stopSpeaking,
    interactionMode,
    setInteractionMode
  };
}
