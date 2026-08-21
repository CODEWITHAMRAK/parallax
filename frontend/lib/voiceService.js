export class VoiceController {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.audioElement = null;
    this.stream = null;
  }

  async startListening() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: 'audio/webm' });
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
    } catch (error) {
      console.error("Microphone permission denied or error:", error);
      throw new Error("Microphone access is required for voice interaction.");
    }
  }

  stopListening() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        
        // Stop all tracks to release microphone
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
        }
        
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  async transcribe(audioBlob) {
    if (!audioBlob) throw new Error("No audio to transcribe");

    const formData = new FormData();
    formData.append("audio", audioBlob, "audio.webm");

    // Replace with the actual URL/port if different or use relative if proxy is setup
    // Since Next.js is likely running on 3000 and express on 8080, we need full URL or proxy
    // I'll assume the backend is at http://localhost:8080
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    
    const response = await fetch(`${backendUrl}/api/voice/transcribe`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Backend STT error response:", errText);
      throw new Error(`Failed to transcribe audio: ${errText}`);
    }

    const data = await response.json();
    return data.text;
  }

  async speak(text, languageCode = "hi-IN") {
    // Stop currently speaking audio before starting a new one
    this.stopSpeaking();

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    
    const response = await fetch(`${backendUrl}/api/voice/speak`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text, languageCode })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Backend TTS error response:", errText);
      throw new Error(`Failed to synthesize speech: ${errText}`);
    }

    const data = await response.json();
    if (!data.audio) {
      throw new Error("No audio returned");
    }

    // Play base64 audio
    return new Promise((resolve, reject) => {
      const audioSource = `data:audio/wav;base64,${data.audio}`;
      this.audioElement = new Audio(audioSource);
      
      this.audioElement.onended = () => {
        resolve();
      };
      
      this.audioElement.onerror = (e) => {
        console.error("Audio playback error:", e);
        reject(new Error("Audio playback failed"));
      };

      this.audioElement.play().catch(reject);
    });
  }

  stopSpeaking() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.audioElement = null;
    }
  }
}

// Export a singleton instance
export const voiceService = new VoiceController();
