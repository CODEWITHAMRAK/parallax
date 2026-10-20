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
  connection_trouble: "Sorry, I'm having trouble connecting right now.",
  // UI Strings
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

export const useTranslation = () => {
  // Subscribe to dictionary to force re-render when language changes
  const dictionary = useLocalizationStore((state) => state.dictionary);
  return useLocalizationStore((state) => state.t);
};

export default useLocalizationStore;
