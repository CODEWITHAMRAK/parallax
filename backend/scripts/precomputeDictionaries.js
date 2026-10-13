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
  connection_trouble: "Sorry, I'm having trouble connecting right now.",
  sign_out: "Sign Out",
  voice_mode: "Voice Mode",
  text_mode: "Text Mode",
  service_dashboard: "Service Dashboard",
  select_service: "Select a service application below to get started.",
  available_services: "Available Services",
  search_services: "Search services...",
  no_services: "No services found matching",
  application_badge: "Application",
  welcome_parallax: "Welcome to Parallax",
  interact_how: "How would you like to interact today?",
  normal_mode: "Normal Mode",
  normal_mode_desc: "Use touch, mouse, and keyboard to interact with the app.",
  no_touch_mode: "No Touch Mode",
  no_touch_mode_desc: "Navigate entirely by voice",
  select_language: "Select Your Language",
  choose_language: "Choose the language you are most comfortable with.",
  go_back: "Go Back",
  logout: "Logout",
  parallax: "PARALLAX",
  hero_desc: "Empowering everyone with intelligent, voice-guided digital services. Experience a seamless form engine built for modern inclusion.",
  explore_services: "Explore Services",
  core_features: "Core Features",
  feat_voice_title: "Voice Guided",
  feat_voice_desc: "Interact entirely through speech without touching a screen.",
  feat_autofill_title: "Smart Autofill",
  feat_autofill_desc: "Scan documents and automate instant data entry securely.",
  feat_inclusive_title: "Inclusive Design",
  feat_inclusive_desc: "Designed ground-up for cognitive & motor accessibility needs.",
  feat_lang_title: "Multi-Language",
  feat_lang_desc: "Access the entire platform in your preferred regional language.",
  feat_save_title: "Auto-Save Drafts",
  feat_save_desc: "Never lose your work. Drafts are automatically saved as you navigate.",
  feat_val_title: "Real-time Validation",
  feat_val_desc: "Instant feedback on your inputs to ensure accurate submissions.",
  footer: "Parallax System",
  rescan: "Rescan",
  reupload: "Re-upload",
  view_document: "View Document",
  record_audio: "Record Audio",
  playing_audio: "Playing Audio...",
  start_audio_response: "Start Audio Response",
  saving: "Saving...",
  saved: "Saved",
  review_submit: "Review & Submit",
  read_details: "Read Details",
  edit: "Edit",
  submit_application: "Submit Application",
  submitting_form: "Submitting...",
  go_back_form: "Go Back",
  next: "Next",
  previous: "Previous",
  cancel: "Cancel",
  save_draft: "Save Draft"
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in .env");
  }

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gemini-3.5-flash-lite",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 8192,
      temperature: 0.1,
      stream: false
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
