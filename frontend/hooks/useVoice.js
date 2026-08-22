import { create } from 'zustand';
import { useState, useCallback } from 'react';
import { voiceService } from '../lib/voiceService';
import useLocalizationStore from '../store/useLocalizationStore';

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
          const t = useLocalizationStore.getState().t;
          setErrorMsg(t('didnt_understand'));
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

  const pauseListening = useCallback((submit = true) => {
    voiceService.pauseListening(submit);
    setState(VoiceState.IDLE);
  }, []);

  const speak = useCallback(async (text, onPlaybackStart = null) => {
    try {
      setState(VoiceState.SPEAKING);
      await voiceService.speak(text, "en-IN", onPlaybackStart);
      setState(prev => prev === VoiceState.SPEAKING ? VoiceState.IDLE : prev);
    } catch (err) {
      console.error('TTS Error:', err);
      setState(prev => prev === VoiceState.SPEAKING ? VoiceState.IDLE : prev);
    }
  }, []);

  const playSystemAudio = useCallback(async (type) => {
    try {
      setState(VoiceState.SPEAKING);
      // Assuming hi-IN is default, can be dynamically linked to Language state later
      await voiceService.playSystemAudio(type, "hi-IN");
      setState(prev => prev === VoiceState.SPEAKING ? VoiceState.IDLE : prev);
    } catch (err) {
      console.error('System Audio Error:', err);
      setState(prev => prev === VoiceState.SPEAKING ? VoiceState.IDLE : prev);
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
