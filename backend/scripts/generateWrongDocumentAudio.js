import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const LANG_MAP = {
  'English': 'en-IN',
  'Hindi': 'hi-IN',
  'Kannada': 'kn-IN'
};

const textToTranslate = "This does not appear to be the correct document.";

async function translateText(text, lang) {
  if (lang === 'English') return text;

  const prompt = `Translate the following English sentence into ${lang}. Return ONLY the translated sentence, without any quotes, explanations, or additional text.\n\nEnglish: ${text}`;
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not defined");

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gemini-3.5-flash-lite",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 100,
      temperature: 0.1,
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`LLM API Error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
}

async function generateTTS(text, langCode) {
  const apiKeyString = process.env.SARVAM_API_KEYS;
  if (!apiKeyString) throw new Error("SARVAM_API_KEYS is not defined");
  const keys = apiKeyString.split(',').map(k => k.trim()).filter(k => k.length > 0);

  const payload = {
    inputs: [text],
    target_language_code: langCode,
    speaker: "ishita",
    pace: 1.0,
    speech_sample_rate: 8000,
    enable_preprocessing: true,
    model: "bulbul:v3"
  };

  let lastErr = null;
  for (const apiKey of keys) {
    try {
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
        throw new Error(`Sarvam TTS Error: ${errText}`);
      }

      const data = await response.json();
      if (data.audios && data.audios.length > 0) {
        return data.audios[0];
      } else {
        throw new Error("No audio returned from Sarvam");
      }
    } catch (e) {
      console.warn(`    Key failed: ${apiKey.substring(0, 10)}... ${e.message}`);
      lastErr = e;
    }
  }
  
  throw lastErr;
}

async function main() {
  const frontendAudioDir = path.join(__dirname, '../../frontend/public/audio/scanner');

  for (const [langName, langCode] of Object.entries(LANG_MAP)) {
    console.log(`Processing ${langName} (${langCode})...`);
    
    try {
      // 1. Translate
      const translated = await translateText(textToTranslate, langName);
      console.log(`  Translation: ${translated}`);
      
      // 2. Generate TTS
      const base64Audio = await generateTTS(translated, langCode);
      
      // 3. Save to file
      const dirPath = path.join(frontendAudioDir, langCode);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      const filePath = path.join(dirPath, 'wrong_document.wav');
      const audioBuffer = Buffer.from(base64Audio, 'base64');
      fs.writeFileSync(filePath, audioBuffer);
      
      console.log(`  Saved to ${filePath}`);
    } catch (error) {
      console.error(`  Error processing ${langName}:`, error.message);
    }
  }
  
  console.log("Done generating audio.");
}

main();
