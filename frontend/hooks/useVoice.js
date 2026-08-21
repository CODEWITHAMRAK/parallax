import { useState, useCallback } from 'react';
import { voiceService } from '../lib/voiceService.js';

export const VoiceState = {
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  PROCESSING: 'PROCESSING',
  SPEAKING: 'SPEAKING',
  ERROR: 'ERROR'
};

export function useVoice() {
  const [state, setState] = useState(VoiceState.IDLE);
  const [errorMsg, setErrorMsg] = useState('');
  const [language, setLanguage] = useState('en-IN');
  const [transcribedText, setTranscribedText] = useState('');

  const startListening = useCallback(async () => {
    try {
      voiceService.stopSpeaking(); // Barge-in: stop any current speech
      setErrorMsg('');
      setState(VoiceState.LISTENING);
      await voiceService.startListening();
    } catch (err) {
      setState(VoiceState.ERROR);
      setErrorMsg(err.message || 'Microphone access denied.');
    }
  }, []);

  const stopListeningAndTranscribe = useCallback(async () => {
    if (state !== VoiceState.LISTENING) return null;
    
    try {
      setState(VoiceState.PROCESSING);
      const audioBlob = await voiceService.stopListening();
      if (!audioBlob) {
        setState(VoiceState.IDLE);
        return null;
      }

      const text = await voiceService.transcribe(audioBlob);
      setTranscribedText(text);
      setState(VoiceState.IDLE);
      return text;
    } catch (err) {
      console.error(err);
      setState(VoiceState.ERROR);
      setErrorMsg("I couldn't understand that. Please try again.");
      return null;
    }
  }, [state]);

  const speak = useCallback(async (text) => {
    if (!text) return;
    try {
      setState(VoiceState.SPEAKING);
      await voiceService.speak(text, language);
      setState(VoiceState.IDLE);
    } catch (err) {
      console.error("TTS Error:", err);
      // Fail gracefully: don't block the UI, just go back to IDLE
      setState(VoiceState.IDLE);
    }
  }, [language]);

  const stopSpeaking = useCallback(() => {
    voiceService.stopSpeaking();
    if (state === VoiceState.SPEAKING) {
      setState(VoiceState.IDLE);
    }
  }, [state]);

  return {
    state,
    errorMsg,
    language,
    setLanguage,
    transcribedText,
    startListening,
    stopListeningAndTranscribe,
    speak,
    stopSpeaking
  };
}
