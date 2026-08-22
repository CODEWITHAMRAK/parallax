import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getSarvamApiKey } from '../utils/sarvamKeys.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../.env') });



// English, Hindi, Kannada
const languages = [
  "en-IN", "hi-IN", "kn-IN"
];

const phrases = {
  document_lost: "Document lost. Find the document.",
  move_left: "Move slightly left.",
  move_right: "Move slightly right.",
  move_up: "Move slightly up.",
  move_down: "Move slightly down.",
  move_closer: "Move closer.",
  move_back: "Move slightly back.",
  tilt_phone: "Tilt your phone slightly.",
  hold_still: "Hold still.",
  document_captured: "Document captured.",
  verifying_document: "Verifying document readability...",
  looks_good: "This looks good. Would you like to use this document?",
  try_again: "Please try again.",
  saving_document: "Saving document...",
  upload_failed: "Upload failed. Please try again."
};

const outputDir = path.resolve(__dirname, '../../frontend/public/audio/scanner');

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
  console.log("Starting Scanner Audio Generation...");

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

  console.log("\nDone generating all scanner audios!");
}

main().catch(console.error);
