import fs from 'fs';
import { getSarvamApiKey } from '../utils/sarvamKeys.js';

export const transcribeAudio = async (req, res) => {
  try {
    const apiKey = getSarvamApiKey();
    if (!apiKey) {
      throw new Error("SARVAM_API_KEYS is not defined in environment variables");
    }
    if (!req.file) {
      return res.status(400).json({ message: "No audio file provided" });
    }

    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    const ext = req.file.mimetype.includes('mp4') ? 'mp4' : 'webm';
    formData.append('file', blob, `audio.${ext}`);

    // Sarvam API STT model parameter
    formData.append('model', 'saaras:v3');

    const response = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: {
        "api-subscription-key": apiKey
      },
      body: formData
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Sarvam STT Error:", errText);
      throw new Error(errText);
    }

    const data = await response.json();
    res.status(200).json({ text: data.transcript || "" });
  } catch (error) {
    console.error("Transcribe controller error:", error);
    res.status(500).json({ message: "Error processing audio", error: error.message });
  }
};

export const speakText = async (req, res) => {
  try {
    const apiKey = getSarvamApiKey();
    if (!apiKey) {
      throw new Error("SARVAM_API_KEYS is not defined in environment variables");
    }

    const { text, languageCode = "hi-IN" } = req.body;
    if (!text) {
      return res.status(400).json({ message: "Text is required" });
    }

    const payload = {
      inputs: [text],
      target_language_code: languageCode,
      speaker: "ishita",
      pace: 1.1,
      speech_sample_rate: 22050,
      enable_preprocessing: true,
      model: "bulbul:v3"
    };

    const response = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "api-subscription-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Sarvam TTS Error:", errText);
      throw new Error(errText);
    }

    const data = await response.json();
    if (data.audios && data.audios.length > 0) {
      res.status(200).json({ audio: data.audios[0] });
    } else {
      throw new Error("No audio returned from Sarvam");
    }
  } catch (error) {
    console.error("Speak controller error:", error);
    res.status(500).json({ message: "Error synthesizing speech", error: error.message });
  }
};
