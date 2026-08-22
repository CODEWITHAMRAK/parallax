import { create } from 'zustand';
import { useState, useCallback, useRef } from 'react';
import { voiceService } from '../lib/voiceService';
import useLocalizationStore from '../store/useLocalizationStore';
import useNavigationStore from '../store/useNavigationStore';

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
  const scannerAudioRef = useRef(null);

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

  const playScannerAudio = useCallback((text) => {
    const textToKey = {
      "Document lost. Find the document.": "document_lost",
      "Move slightly left.": "move_left",
      "Move slightly right.": "move_right",
      "Move slightly up.": "move_up",
      "Move slightly down.": "move_down",
      "Move closer.": "move_closer",
      "Move slightly back.": "move_back",
      "Tilt your phone slightly.": "tilt_phone",
      "Hold still.": "hold_still",
      "Document captured.": "document_captured",
      "Verifying document readability...": "verifying_document",
      "This looks good. Would you like to use this document?": "looks_good",
      "Please try again.": "try_again",
      "Saving document...": "saving_document",
      "Upload failed. Please try again.": "upload_failed"
    };

    const langMap = {
      'English': 'en-IN',
      'Hindi': 'hi-IN',
      'Kannada': 'kn-IN'
    };

    const key = textToKey[text];
    if (!key) {
      speak(text); // fallback
      return;
    }

    const currentLang = useNavigationStore.getState().language;
    const langCode = langMap[currentLang] || 'en-IN';
    const audioUrl = `/audio/scanner/${langCode}/${key}.wav`;

    const isHighPriority = ["document_captured", "looks_good", "try_again", "upload_failed"].includes(key);

    // If something is currently playing
    if (scannerAudioRef.current && !scannerAudioRef.current.paused) {
      if (isHighPriority) {
        // High priority interrupts immediately
        scannerAudioRef.current.pause();
        scannerAudioRef.current.currentTime = 0;
      } else {
        // Normal priority waits its turn (ignores this trigger)
        return; 
      }
    }

    const audio = new Audio(audioUrl);
    scannerAudioRef.current = audio;
    
    audio.play().catch(e => console.error("Error playing precomputed audio:", e));
  }, [speak]);

  return {
    state,
    transcribedText,
    errorMsg,
    startListening,
    pauseListening, // renamed from stopListeningAndTranscribe as it no longer fetches manually
    speak,
    playSystemAudio,
    playScannerAudio,
    stopSpeaking,
    interactionMode,
    setInteractionMode
  };
}
