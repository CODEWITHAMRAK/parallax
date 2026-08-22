import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getSarvamApiKey } from '../utils/sarvamKeys.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../.env') });



// 10 Indic Languages + English supported by Sarvam Translate
const languages = [
  "hi-IN", "bn-IN", "kn-IN", "ml-IN", "mr-IN", "od-IN", "pa-IN", 
  "ta-IN", "te-IN", "gu-IN", "en-IN"
];

const phrases = {
  didnt_catch: "I didn't catch that. Could you please repeat?",
  are_you_there: "Are you still there? I didn't hear any response.",
  network_error: "Sorry, I'm having trouble connecting right now."
};

const outputDir = path.resolve(__dirname, '../../frontend/public/audio/system');

async function translateText(text, targetLang) {
  if (targetLang === "en-IN") return text; // No need to translate English to English

  const response = await fetch("https://api.sarvam.ai/translate", {
    method: "POST",
    headers: {
      "api-subscription-key": getSarvamApiKey(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      input: text,
      source_language_code: "en-IN",
      target_language_code: targetLang,
      speaker_gender: "Female",
      mode: "formal",
      model: "sarvam-translate:v1"
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Translation failed for ${targetLang}:`, errText);
    throw new Error(`Translation failed: ${errText}`);
  }

  const data = await response.json();
  return data.translated_text;
}

async function generateSpeech(text, targetLang) {
  const payload = {
    inputs: [text],
    target_language_code: targetLang,
    speaker: "ishita",
    pace: 1.0,
    speech_sample_rate: 8000,
    enable_preprocessing: true,
    model: "bulbul:v3"
  };

  const response = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: {
      "api-subscription-key": getSarvamApiKey(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`TTS failed for ${targetLang}:`, errText);
    throw new Error(`TTS failed: ${errText}`);
  }

  const data = await response.json();
  if (data.audios && data.audios.length > 0) {
    return data.audios[0];
  }
  throw new Error("No audio returned");
}

async function main() {
  console.log("Starting System Audio Generation...");

  for (const lang of languages) {
    const langDir = path.join(outputDir, lang);
    if (!fs.existsSync(langDir)) {
      fs.mkdirSync(langDir, { recursive: true });
    }

    console.log(`\nProcessing language: ${lang}`);

    for (const [key, englishText] of Object.entries(phrases)) {
      try {
        console.log(`  -> Translating '${key}'...`);
        const translatedText = await translateText(englishText, lang);
        
        console.log(`  -> Synthesizing '${key}': "${translatedText}"`);
        const base64Audio = await generateSpeech(translatedText, lang);

        const filePath = path.join(langDir, `${key}.wav`);
        fs.writeFileSync(filePath, Buffer.from(base64Audio, 'base64'));
        console.log(`  -> Saved to ${filePath}`);
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`  -> Failed for ${key} in ${lang}`);
      }
    }
  }

  console.log("\nDone generating all system audios!");
}

main().catch(console.error);
