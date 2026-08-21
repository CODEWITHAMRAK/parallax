import { create } from 'zustand';

const useNavigationStore = create((set, get) => ({
  currentPage: "home", // "home", "form", etc.
  currentStepIndex: 0,
  currentFieldId: null,
  lastAction: null,
  systemMessage: "Welcome to Lumina Assist. How can I help you today?",

  setPage: (pageId) => {
    set({ currentPage: pageId, systemMessage: "" });
  },

  setStep: (stepIndex, message = "") => {
    set({ currentStepIndex: stepIndex, systemMessage: message });
  },

  setField: (fieldId, message = "") => {
    set({ currentFieldId: fieldId, systemMessage: message });
  },

  setSystemMessage: (message) => {
    set({ systemMessage: message });
  },

  setLastAction: (actionType) => {
    set({ lastAction: actionType });
  },

  nextStep: (totalSteps, message = "") => {
    set((state) => {
      if (state.currentStepIndex < totalSteps - 1) {
        return { currentStepIndex: state.currentStepIndex + 1, systemMessage: message };
      }
      return { systemMessage: "You are already on the last step." };
    });
  },

  prevStep: (message = "") => {
    set((state) => {
      if (state.currentStepIndex > 0) {
        return { currentStepIndex: state.currentStepIndex - 1, systemMessage: message };
      }
      return { systemMessage: "You are already on the first step." };
    });
  }
}));

export default useNavigationStore;
