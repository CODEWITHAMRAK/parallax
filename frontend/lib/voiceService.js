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
    this.MIN_DECIBELS = 15; // Calibrated for responsive human voice detection across standard microphones
    this.INITIAL_SILENCE_DURATION = 18000; // 18s timeout if no speech is detected at all
    this.SPEECH_COMPLETION_DURATION = 500; // 0.5s of silence after speech triggers end
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
      // Warm persistent stream: Reuse existing stream if active for instant (<5ms) turn start
      if (!this.stream || !this.stream.active || !this.audioContext || this.audioContext.state === "closed") {
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
      } else if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      let options = { mimeType: 'audio/webm' };
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        options = MediaRecorder.isTypeSupported('audio/mp4') ? { mimeType: 'audio/mp4' } : {};
      }
      this.mediaRecorder = new MediaRecorder(this.stream, options);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        const mimeType = (this.mediaRecorder && this.mediaRecorder.mimeType) ? this.mediaRecorder.mimeType : 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
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

      // Initial silence safety net (if no speech detected in 12s)
      this.initialSilenceTimer = setTimeout(() => {
        if (this.isListening && !this.speechStarted) {
          console.warn("[VAD] Initial silence timeout reached. Stopping.");
          this.pauseListening(false);
        }
      }, this.INITIAL_SILENCE_DURATION);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      this.checkInterval = setInterval(() => {
        if (!this.analyser || !this.isListening) return;

        this.analyser.getByteFrequencyData(dataArray);

        // Focus on vocal frequency range (bins 2 to 45, ~150Hz to 3.5kHz)
        // Skipping bins 0-1 to eliminate DC offset and 50/60Hz mains hum
        const startBin = 2;
        const endBin = Math.min(45, bufferLength);
        let sum = 0;
        for (let i = startBin; i < endBin; i++) {
          sum += dataArray[i];
        }
        const vocalAverage = sum / (endBin - startBin);

        // Hysteresis: 14 to start speaking, 10 to continue speaking
        const isSpeakingNow = this.speechStarted ? (vocalAverage > 10) : (vocalAverage > 14);

        if (isSpeakingNow) {
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
            console.log(`[VAD] Speech started (energy: ${vocalAverage.toFixed(1)})`);
            if (onSpeechStartCallback) onSpeechStartCallback();
          }
        } else {
          // Silence detected
          if (this.speechStarted && !this.silenceTimer) {
            this.silenceTimer = setTimeout(() => {
              console.log("[VAD] Speech ended after silence. Stopping and transcribing...");
              this.pauseListening(true);
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

    // Keep stream and audioContext warm for instant next-turn listening
    this.mediaRecorder = null;
    this.isListening = false;
    this.speechStarted = false;
  }

  destroy() {
    this.cleanup();
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
  }

  async transcribe(audioBlob) {
    if (!audioBlob || audioBlob.size < 1000) {
      console.warn("Audio blob empty or too small, skipping transcription");
      return null;
    }
    const formData = new FormData();
    const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
    formData.append("audio", audioBlob, `audio.${ext}`);

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

  async _fetchTTSAudio(text, languageCode) {
    const response = await fetch(`${API_URL}/api/voice/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, languageCode }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Failed to synthesize speech");
    }

    const data = await response.json();
    const audioContent = data.audio;

    const audioBlob = new Blob(
      [Uint8Array.from(atob(audioContent), (c) => c.charCodeAt(0))],
      { type: "audio/wav" }
    );
    return URL.createObjectURL(audioBlob);
  }

  async _playAudioUrl(audioUrl, onPlaybackStart) {
    return new Promise((resolve, reject) => {
      this.speakResolve = resolve;
      this.speakReject = reject;
      this.audioElement = new Audio(audioUrl);
      this.audioElement.onplay = () => {
        if (onPlaybackStart) onPlaybackStart();
      };
      this.audioElement.onended = () => {
        if (this.speakResolve) {
          this.speakResolve();
          this.speakResolve = null;
          this.speakReject = null;
        }
      };
      this.audioElement.onerror = (err) => {
        if (this.speakReject) {
          this.speakReject(err);
          this.speakResolve = null;
          this.speakReject = null;
        }
      };
      this.audioElement.play().catch((err) => {
        if (err.name === 'NotAllowedError') {
          console.warn('[VoiceService] Autoplay prevented by browser (user gesture required).');
        }
        if (this.speakReject) {
          this.speakReject(err);
          this.speakResolve = null;
          this.speakReject = null;
        }
      });
    });
  }

  async queueSpeak(text, languageCode = "en-IN", onPlaybackStart = null) {
    // Start fetching immediately, add the promise to the queue
    const fetchPromise = this._fetchTTSAudio(text, languageCode);
    this.ttsQueue = this.ttsQueue || [];
    this.ttsQueue.push({ fetchPromise, onPlaybackStart });
    
    if (!this.isProcessingTTSQueue) {
      this.processTTSQueue();
    }
  }

  async processTTSQueue() {
    this.isProcessingTTSQueue = true;
    this.isSpeaking = true;
    this.pauseListening(false);
    
    try {
      while (this.ttsQueue && this.ttsQueue.length > 0) {
        const { fetchPromise, onPlaybackStart } = this.ttsQueue.shift();
        let audioUrl = null;
        try {
          audioUrl = await fetchPromise;
          await this._playAudioUrl(audioUrl, onPlaybackStart);
        } catch (e) {
          if (e.name === "NotAllowedError") {
            console.warn("[VoiceService] TTS playback skipped due to user interaction requirement.");
          } else {
            console.error("Queue TTS Error:", e);
          }
          if (e.message === "INTERRUPTED") break;
        } finally {
          if (audioUrl) URL.revokeObjectURL(audioUrl);
        }
      }
    } finally {
      this.isSpeaking = false;
      this.isProcessingTTSQueue = false;
    }
  }

  async speak(text, languageCode = "en-IN", onPlaybackStart = null) {
    this.stopSpeaking(); // Clear queue and stop current audio
    return new Promise((resolve, reject) => {
        this.queueSpeak(text, languageCode, onPlaybackStart);
        
        // Polling to wait for queue to empty, keeping backward compatibility
        const checkDone = setInterval(() => {
            if (!this.isProcessingTTSQueue) {
                clearInterval(checkDone);
                resolve();
            }
        }, 100);
    });
  }

  playSystemAudio(type, langCode = "en-IN") {
    const supportedLangs = ["hi-IN", "bn-IN", "kn-IN", "ml-IN", "mr-IN", "od-IN", "pa-IN", "ta-IN", "te-IN", "gu-IN", "en-IN"];
    let validLang = supportedLangs.includes(langCode) ? langCode : "en-IN";
    if (type === "ask_language") {
      validLang = "en-IN";
    }

    return new Promise((resolve) => {
      this.isSpeaking = true;
      this.stopSpeaking();
      this.pauseListening(false);
      this.speakResolve = resolve;

      const audioSource = `/audio/system/${validLang}/${type}.wav`;
      this.audioElement = new Audio(audioSource);

      this.audioElement.onended = () => {
        this.isSpeaking = false;
        if (this.speakResolve) {
          this.speakResolve();
          this.speakResolve = null;
          this.speakReject = null;
        }
      };

      this.audioElement.onerror = (e) => {
        console.warn(`System audio for ${type} in ${validLang} not found, falling back to TTS...`, e);
        let fallbackText = "Sorry, I didn't catch that. Could you please repeat?";
        if (type === "are_you_there" || type === "still_there") fallbackText = "Are you still there? Please say something or tap the mic.";
        if (type === "network_error" || type === "connection_trouble") fallbackText = "Sorry, I'm having trouble connecting right now.";
        if (type === "welcome_home") fallbackText = "Welcome to Parallax! You can tell me what you want to do, like 'Open the scholarship form'.";
        if (type === "ask_language") fallbackText = "Please choose your language. Which language do you speak? ನೀವು ಯಾವ ಭಾಷೆಯನ್ನು ಮಾತನಾಡುತ್ತೀರಿ? आप कौन सी भाषा बोलते हैं?";

        try {
          const t = useLocalizationStore?.getState()?.t;
          if (t) {
            if (type === "didnt_catch" || type === "didnt_understand") fallbackText = t('didnt_catch');
            else if (type === "are_you_there" || type === "still_there") fallbackText = t('still_there');
            else if (type === "network_error" || type === "connection_trouble") fallbackText = t('connection_trouble');
            else if (type === "welcome_home") fallbackText = t('welcome_home') || fallbackText;
          }
        } catch (err) {
          console.warn("Could not retrieve localized string from store:", err);
        }

        this.isSpeaking = false;
        this.speak(fallbackText, validLang).then(() => {
          if (this.speakResolve) {
            this.speakResolve();
            this.speakResolve = null;
            this.speakReject = null;
          }
        }).catch(() => {
          if (this.speakResolve) {
            this.speakResolve();
            this.speakResolve = null;
            this.speakReject = null;
          }
        });
      };

      this.audioElement.play().catch((err) => {
        console.warn("Autoplay was blocked or audio play failed:", err);
        this.isSpeaking = false;
        if (this.speakResolve) {
          this.speakResolve();
          this.speakResolve = null;
          this.speakReject = null;
        }
      });
    });
  }

  stopSpeaking() {
    this.ttsQueue = [];
    this.isProcessingTTSQueue = false;
    this.isSpeaking = false;
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.onended = null;
      this.audioElement.onerror = null;
      this.audioElement.onplay = null;
      this.audioElement = null;
    }
    if (this.speakReject) {
      this.speakReject(new Error("INTERRUPTED"));
      this.speakResolve = null;
      this.speakReject = null;
    } else if (this.speakResolve) {
      this.speakResolve();
      this.speakResolve = null;
    }
  }

  forceStopSpeaking() {
    this.stopSpeaking();
  }
}

export const voiceService = new VoiceController();
