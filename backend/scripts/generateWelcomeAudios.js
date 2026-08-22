import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getSarvamApiKey } from '../utils/sarvamKeys.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const languages = [
  "en-IN", "hi-IN", "kn-IN", "ta-IN", "te-IN", "bn-IN", "gu-IN", "ml-IN", "mr-IN", "od-IN", "pa-IN"
];

const phrase = "Welcome to Parallax! You can tell me what you want to do, like 'Open the scholarship form'.";

const outputDir = path.resolve(__dirname, '../../frontend/public/audio/system');

async function translateText(text, targetLang) {
  if (targetLang === "en-IN") return text;

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
    throw new Error(`Translation failed for ${targetLang}: ${errText}`);
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
    throw new Error(`TTS failed for ${targetLang}: ${errText}`);
  }

  const data = await response.json();
  if (data.audios && data.audios.length > 0) {
    return data.audios[0];
  }
  throw new Error("No audio returned");
}

async function main() {
  console.log("Generating Welcome Home audio for all languages...");
  const translations = {};

  for (const lang of languages) {
    const langDir = path.join(outputDir, lang);
    if (!fs.existsSync(langDir)) {
      fs.mkdirSync(langDir, { recursive: true });
    }

    try {
      console.log(`Processing ${lang}...`);
      const translated = await translateText(phrase, lang);
      translations[lang] = translated;
      console.log(`  -> Translation: "${translated}"`);

      const base64Audio = await generateSpeech(translated, lang);
      const filePath = path.join(langDir, "welcome_home.wav");
      fs.writeFileSync(filePath, Buffer.from(base64Audio, 'base64'));
      console.log(`  -> Saved to ${filePath}`);

      await new Promise(r => setTimeout(r, 600));
    } catch (err) {
      console.error(`  -> Failed for ${lang}:`, err.message);
    }
  }

  console.log("\nTranslations Summary:\n", JSON.stringify(translations, null, 2));
}

main().catch(console.error);
