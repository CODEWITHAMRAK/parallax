import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

// Global state for interaction mode so it persists across pages/components/reloads
export const useVoiceStore = create(
  persist(
    (set) => ({
      interactionMode: 'text',
      setInteractionMode: (mode) => set({ interactionMode: mode }),
    }),
    {
      name: 'voice-mode-storage', // name of the item in the storage (must be unique)
    }
  )
);

const LANG_MAP = {
  'English': 'en-IN',
  'Hindi': 'hi-IN',
  'Bengali': 'bn-IN',
  'Gujarati': 'gu-IN',
  'Kannada': 'kn-IN',
  'Malayalam': 'ml-IN',
  'Marathi': 'mr-IN',
  'Odia': 'od-IN',
  'Punjabi': 'pa-IN',
  'Tamil': 'ta-IN',
  'Telugu': 'te-IN'
};

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
      const currentLang = useNavigationStore.getState().language;
      const langCode = LANG_MAP[currentLang] || 'en-IN';
      await voiceService.speak(text, langCode, onPlaybackStart);
      setState(prev => prev === VoiceState.SPEAKING ? VoiceState.IDLE : prev);
    } catch (err) {
      if (err.message !== "INTERRUPTED") {
          console.error('TTS Error:', err);
      }
      setState(prev => prev === VoiceState.SPEAKING ? VoiceState.IDLE : prev);
      throw err;
    }
  }, []);

  const playSystemAudio = useCallback(async (type) => {
    try {
      setState(VoiceState.SPEAKING);
      const currentLang = useNavigationStore.getState().language;
      const langCode = LANG_MAP[currentLang] || 'en-IN';
      await voiceService.playSystemAudio(type, langCode);
      setState(prev => prev === VoiceState.SPEAKING ? VoiceState.IDLE : prev);
    } catch (err) {
      if (err.message !== "INTERRUPTED") {
          console.error('System Audio Error:', err);
      }
      setState(prev => prev === VoiceState.SPEAKING ? VoiceState.IDLE : prev);
      throw err;
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    voiceService.stopSpeaking();
  }, []);

  const playScannerAudio = useCallback((text) => {
    // Exact strings emitted by GuidanceEngine + DocumentScanner capture flow.
    // Each maps to a pre-saved .wav filename under /audio/scanner/{lang}/.
    const textToKey = {
      // Guidance instructions
      'Point your camera at the document.': 'document_lost',
      'Move back a little.': 'move_back',
      'Move closer to the document.': 'move_closer',
      'Point camera down a little.': 'move_down',
      'Point camera up a little.': 'move_up',
      'Point camera left a little.': 'move_left',
      'Point camera right a little.': 'move_right',
      'Straighten the document.': 'tilt_phone',
      'Hold still.': 'hold_still',

      // Capture & verification flow
      'Document captured.': 'document_captured',
      'Document captured. Processing...': 'document_captured',
      'Verifying document readability...': 'verifying_document',
      'This looks good. Would you like to use this document?': 'looks_good',
      'Please try again.': 'try_again',
      'Saving document...': 'saving_document',
      'Upload failed. Please try again.': 'upload_failed',
      'This does not appear to be the correct document.': 'wrong_document',
    };

    const key = textToKey[text];
    if (!key) {
      speak(text); // fallback
      return;
    }

    const currentLang = useNavigationStore.getState().language;

    console.log(useNavigationStore.getState());

    const langCode = LANG_MAP[currentLang] || 'en-IN';
    const audioUrl = `/audio/scanner/${langCode}/${key}.wav`;

    const isHighPriority = ["document_captured", "looks_good", "try_again", "upload_failed"].includes(key);

    // Prevent overlapping with active AI speech
    if (voiceService.isSpeaking) {
      if (!isHighPriority) {
        return;
      }
      voiceService.stopSpeaking();
    }

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

  const queueSpeak = useCallback((text, onPlaybackStart = null) => {
    try {
      setState(VoiceState.SPEAKING);
      const currentLang = useNavigationStore.getState().language;
      const langCode = LANG_MAP[currentLang] || 'en-IN';
      voiceService.queueSpeak(text, langCode, onPlaybackStart);
    } catch (err) {
      console.error('Queue TTS Error:', err);
    }
  }, []);

  const waitForSpeakQueue = useCallback(() => {
    return new Promise((resolve) => {
      const checkDone = setInterval(() => {
        if (!voiceService.isProcessingTTSQueue) {
          clearInterval(checkDone);
          setState(prev => prev === VoiceState.SPEAKING ? VoiceState.IDLE : prev);
          resolve();
        }
      }, 100);
    });
  }, []);

  return {
    state,
    transcribedText,
    errorMsg,
    startListening,
    pauseListening, // renamed from stopListeningAndTranscribe as it no longer fetches manually
    speak,
    queueSpeak,
    waitForSpeakQueue,
    playSystemAudio,
    playScannerAudio,
    stopSpeaking,
    interactionMode,
    setInteractionMode
  };
}
