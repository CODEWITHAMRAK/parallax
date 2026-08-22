import useLocalizationStore from "../store/useLocalizationStore.js";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export class VoiceController {
  constructor() {
    this.stream = null;
    this.audioContext = null;
    this.analyser = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.audioElement = null;

    this.isListening = false;
    this.speechStarted = false;
    this.isSpeaking = false;
    this.shouldSubmit = true;
    this.silenceTimer = null;
    this.checkInterval = null;

    // Constants
    this.MIN_DECIBELS = 15; // Increased threshold to avoid triggering on background noise
    this.INITIAL_SILENCE_DURATION = 8000; // 8s timeout if no speech is detected at all
    this.SPEECH_COMPLETION_DURATION = 2500; // 2.5s of silence after speech triggers end
    this.MAX_DURATION = 30000; // 30s hard stop
    this.maxTimer = null;
    this.initialSilenceTimer = null;
  }

  async startListening(onSpeechStartCallback = null, onSpeechEndCallback = null) {
    if (this.isListening) return;
    if (this.isSpeaking) {
      console.warn("[VoiceService] Blocked startListening because AI is currently speaking.");
      return;
    }
    
    // Acquire lock immediately to prevent concurrent orphaned streams
    this.isListening = true;
    
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false }
      });

      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;
      this.analyser.smoothingTimeConstant = 0.85;
      source.connect(this.analyser);

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: 'audio/webm' });
      this.audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const process = this.shouldSubmit !== false;
        this.shouldSubmit = true; // reset
        this.audioChunks = [];
        this.cleanup();
        if (process && onSpeechEndCallback) onSpeechEndCallback(audioBlob);
      };

      this.mediaRecorder.start();
      this.isListening = true;
      this.speechStarted = false;

      // Max duration safety net
      this.maxTimer = setTimeout(() => {
        if (this.isListening) {
          console.warn("[VAD] Max duration reached. Stopping.");
          this.pauseListening();
        }
      }, this.MAX_DURATION);

      // Initial silence safety net (if no speech detected in 4s)
      this.initialSilenceTimer = setTimeout(() => {
        if (this.isListening && !this.speechStarted) {
          console.warn("[VAD] Initial silence timeout reached. Stopping.");
          this.pauseListening();
        }
      }, this.INITIAL_SILENCE_DURATION);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      this.checkInterval = setInterval(() => {
        if (!this.analyser || !this.isListening) return;

        this.analyser.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const average = sum / bufferLength;

        if (average > this.MIN_DECIBELS) {
          // Noise detected above threshold
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }
          if (!this.speechStarted) {
            this.speechStarted = true;
            if (this.initialSilenceTimer) {
              clearTimeout(this.initialSilenceTimer);
              this.initialSilenceTimer = null;
            }
            console.log("[VAD] Speech started.");
            if (onSpeechStartCallback) onSpeechStartCallback();
          }
        } else {
          // Silence detected
          if (this.speechStarted && !this.silenceTimer) {
            this.silenceTimer = setTimeout(() => {
              console.log("[VAD] Speech completion silence detected. Stopping.");
              this.pauseListening();
            }, this.SPEECH_COMPLETION_DURATION);
          }
        }
      }, 100);

    } catch (error) {
      this.isListening = false;
      console.error("Microphone permission denied or VAD error:", error);
      throw new Error("Microphone access is required for voice interaction.");
    }
  }

  pauseListening(submit = true) {
    this.isListening = false;
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.shouldSubmit = submit;
      this.mediaRecorder.stop();
    } else {
      this.cleanup();
    }
  }

  cleanup() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.maxTimer) clearTimeout(this.maxTimer);
    if (this.initialSilenceTimer) clearTimeout(this.initialSilenceTimer);
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.mediaRecorder = null;
    this.isListening = false;
    this.speechStarted = false;
  }

  async transcribe(audioBlob) {
    if (!audioBlob || audioBlob.size < 1000) {
       console.warn("Audio blob empty or too small, skipping transcription");
       return null;
    }
    const formData = new FormData();
    formData.append("audio", audioBlob, "audio.webm");

    const response = await fetch(`${API_URL}/api/voice/transcribe`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Failed to transcribe audio");
    }

    const data = await response.json();
    return data.text;
  }

  async speak(text, languageCode = "en-IN", onPlaybackStart = null) {
    this.isSpeaking = true;
    this.stopSpeaking();
    this.pauseListening(false); // Ensure microphone is off while TTS plays to avoid echoes, and don't submit noise

    try {
      const response = await fetch(`${API_URL}/api/voice/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, languageCode }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.isSpeaking = false;
        throw new Error(errorText || "Failed to synthesize speech");
      }

      const data = await response.json();
      const audioContent = data.audio;

      const audioBlob = new Blob(
        [Uint8Array.from(atob(audioContent), (c) => c.charCodeAt(0))],
        { type: "audio/wav" }
      );
      const audioUrl = URL.createObjectURL(audioBlob);

      return new Promise((resolve, reject) => {
        this.audioElement = new Audio(audioUrl);
        this.audioElement.onplay = () => {
          if (onPlaybackStart) onPlaybackStart();
        };
        this.audioElement.onended = () => {
          URL.revokeObjectURL(audioUrl);
          this.isSpeaking = false;
          resolve();
        };
        this.audioElement.onerror = (err) => {
          this.isSpeaking = false;
          reject(err);
        };
        this.audioElement.play().catch((err) => {
          this.isSpeaking = false;
          reject(err);
        });
      });
    } catch (e) {
      this.isSpeaking = false;
      throw e;
    }
  }

  playSystemAudio(type, langCode = "en-IN") {
    const supportedLangs = ["hi-IN", "bn-IN", "kn-IN", "ml-IN", "mr-IN", "od-IN", "pa-IN", "ta-IN", "te-IN", "gu-IN", "en-IN"];
    const validLang = supportedLangs.includes(langCode) ? langCode : "en-IN";

    return new Promise((resolve, reject) => {
      this.isSpeaking = true;
      this.stopSpeaking();
      this.pauseListening(false); // Don't submit ambient noise when interrupting with system audio
      
      const audioSource = `/audio/system/${validLang}/${type}.wav`;
      this.audioElement = new Audio(audioSource);
      
      this.audioElement.onended = () => {
        this.isSpeaking = false;
        resolve();
      };
      
      this.audioElement.onerror = (e) => {
        console.error("System audio playback error:", e);
        console.warn(`System audio for ${type} in ${validLang} not found, falling back to TTS...`);
        let fallbackText = "Sorry, I didn't catch that. Could you please repeat?";
        if (type === "are_you_there" || type === "still_there") fallbackText = "Are you still there? Please say something or tap the mic.";
        if (type === "network_error" || type === "connection_trouble") fallbackText = "Sorry, I'm having trouble connecting right now.";
        
        try {
          const t = useLocalizationStore?.getState()?.t;
          if (t) {
            if (type === "didnt_catch" || type === "didnt_understand") fallbackText = t('didnt_catch');
            else if (type === "are_you_there" || type === "still_there") fallbackText = t('still_there');
            else if (type === "network_error" || type === "connection_trouble") fallbackText = t('connection_trouble');
          }
        } catch (err) {
          console.warn("Could not retrieve localized string from store:", err);
        }

        this.isSpeaking = false;
        this.speak(fallbackText, validLang).then(resolve).catch(reject);
      };

      this.audioElement.play().catch((err) => {
        this.isSpeaking = false;
        reject(err);
      });
    });
  }

  stopSpeaking() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = null;
    }
  }

  forceStopSpeaking() {
    this.isSpeaking = false;
    this.stopSpeaking();
  }
}

export const voiceService = new VoiceController();
