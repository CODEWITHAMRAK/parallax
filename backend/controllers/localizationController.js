import { getLLMAction } from "../services/llmService.js";
import { sendSuccess } from "../utils/response.js";

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseDictionary = {
  welcome_home: "Welcome to Parallax! You can tell me what you want to do, like 'Open the scholarship form'.",
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

let dictionaryCache = {
  'English': baseDictionary
};

// Load precomputed dictionaries
try {
  const dictPath = path.join(__dirname, '../utils/dictionaries.json');
  if (fs.existsSync(dictPath)) {
    const fileData = fs.readFileSync(dictPath, 'utf8');
    dictionaryCache = JSON.parse(fileData);
    console.log("Loaded precomputed localization dictionaries.");
  }
} catch (err) {
  console.error("Failed to load precomputed dictionaries:", err);
}

export const getLocalizedDictionary = async (req, res) => {
  try {
    const { lang } = req.params;
    
    if (!lang) {
      return res.status(400).json({ success: false, message: "Language is required" });
    }

    if (dictionaryCache[lang]) {
      return sendSuccess(res, dictionaryCache[lang], "Dictionary retrieved from cache");
    }

    // Call Mimo to translate the dictionary
    const prompt = `You are a professional localization expert. Translate the following JSON dictionary of UI strings from English into ${lang}. 
Ensure that placeholders like {{field}} and {{target}} remain exactly as they are in the translation. Keep the tone helpful, simple, and polite. 
Return ONLY valid JSON that matches the exact structure of the input, with translated values.

Input JSON:
${JSON.stringify(baseDictionary, null, 2)}
`;

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
        max_tokens: 1500,
        temperature: 0.1,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`LLM API Error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content.trim();
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Failed to parse JSON dictionary from LLM response: ${content}`);
    }

    const translatedDictionary = JSON.parse(jsonMatch[0]);
    
    // Fallback missing keys to English
    for (const key in baseDictionary) {
      if (!translatedDictionary[key]) {
        translatedDictionary[key] = baseDictionary[key];
      }
    }

    // Cache it
    dictionaryCache[lang] = translatedDictionary;

    return sendSuccess(res, translatedDictionary, "Dictionary translated and retrieved");

  } catch (error) {
    console.error("Localization Error:", error);
    // Fallback to English on error
    return sendSuccess(res, baseDictionary, "Fallback to English due to error");
  }
};
