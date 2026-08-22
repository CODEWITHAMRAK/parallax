import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const baseDictionary = {
  missing_field: "Your {{field}} is still missing. Please provide it before moving on.",
  missing_field_next: "Your {{field}} is still missing. Please provide it before moving next.",
  no_active_form: "No active form.",
  step_not_found: "I couldn't find that step.",
  already_last_step: "You are already on the last step.",
  already_first_step: "You are already on the first step.",
  updated_form: "Got it. I've updated the form.",
  cleared_all: "I have cleared all your details.",
  cleared_field: "Cleared the value for {{field}}.",
  explain_field: "I can explain this field.",
  submitting: "Submitting your application...",
  restarted_form: "The form has been restarted. Let's begin from the first step.",
  not_sure: "I'm not sure how to do that.",
  home_nav: "Taking you to the home page.",
  form_nav: "Opening the scholarship form.",
  page_not_found: "I couldn't find the page: {{target}}",
  didnt_understand: "I didn't understand that. Could you please rephrase?",
  here_to_help: "I'm here to help.",
  didnt_catch: "Sorry, I didn't catch that. Could you please repeat?",
  still_there: "Are you still there? Please say something or tap the mic.",
  connection_trouble: "Sorry, I'm having trouble connecting right now."
};

const LANGUAGES = [
  'Hindi', 'Bengali', 'Gujarati', 'Kannada', 'Malayalam', 
  'Marathi', 'Odia', 'Punjabi', 'Tamil', 'Telugu'
];

async function translateDictionary(lang) {
  console.log(`Translating to ${lang}...`);
  const prompt = `You are a professional localization expert. Translate the following JSON dictionary of UI strings from English into ${lang}. 
Ensure that placeholders like {{field}} and {{target}} remain exactly as they are in the translation. Keep the tone helpful, simple, and polite. 
Return ONLY valid JSON that matches the exact structure of the input, with translated values.

Input JSON:
${JSON.stringify(baseDictionary, null, 2)}
`;

  const apiKey = process.env.MIMO_API_KEY;
  if (!apiKey) {
    throw new Error("MIMO_API_KEY is not set in .env");
  }

  const response = await fetch("https://api.xiaomimimo.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "mimo-v2.5-pro",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500,
      temperature: 0.1,
      stream: false,
      thinking: {type: "disabled"}
    })
  });

  if (!response.ok) {
    throw new Error(`LLM API Error for ${lang}: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  let content = data.choices[0].message.content.trim();
  
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Failed to parse JSON for ${lang}: ${content}`);
  }

  const translated = JSON.parse(jsonMatch[0]);
  
  // Fallback
  for (const key in baseDictionary) {
    if (!translated[key]) {
      translated[key] = baseDictionary[key];
    }
  }

  return translated;
}

async function run() {
  const dictionaryCache = {
    'English': baseDictionary
  };

  const outPath = path.join(__dirname, '../utils/dictionaries.json');

  // Load existing if available to resume
  if (fs.existsSync(outPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      Object.assign(dictionaryCache, existing);
    } catch (e) {
      console.error("Could not parse existing dictionaries.json, starting fresh.");
    }
  }

  for (const lang of LANGUAGES) {
    if (!dictionaryCache[lang]) {
      try {
        const dict = await translateDictionary(lang);
        dictionaryCache[lang] = dict;
        console.log(`Successfully translated ${lang}.`);
        
        // Save incrementally
        fs.writeFileSync(outPath, JSON.stringify(dictionaryCache, null, 2));
        
        // Sleep to respect rate limits
        await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        console.error(`Error translating ${lang}:`, err.message);
      }
    } else {
      console.log(`Skipping ${lang}, already precomputed.`);
    }
  }

  console.log("Precomputation complete! Dictionaries saved to", outPath);
}

run();
