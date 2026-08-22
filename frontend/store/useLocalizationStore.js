import { create } from 'zustand';
import { apiFetch } from '../lib/api.js';

// Fallback basic English dictionary
const fallbackDictionary = {
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

const useLocalizationStore = create((set, get) => ({
  dictionary: fallbackDictionary,
  loading: false,

  fetchDictionary: async (lang) => {
    if (!lang || lang === 'English') {
      set({ dictionary: fallbackDictionary });
      return;
    }
    
    set({ loading: true });
    try {
      const res = await apiFetch(`/api/localization/${encodeURIComponent(lang)}`);
      const data = await res.json();
      if (data.success && data.data) {
        set({ dictionary: data.data, loading: false });
      } else {
        set({ loading: false });
      }
    } catch (error) {
      console.error("Failed to fetch dictionary", error);
      set({ loading: false });
    }
  },

  // Translation function: replaces {{key}} with values from params
  t: (key, params = {}) => {
    const { dictionary } = get();
    let text = dictionary[key] || fallbackDictionary[key] || key;
    
    // Interpolate parameters
    Object.keys(params).forEach(paramKey => {
      const regex = new RegExp(`{{${paramKey}}}`, 'g');
      text = text.replace(regex, params[paramKey]);
    });
    
    return text;
  }
}));

export default useLocalizationStore;
