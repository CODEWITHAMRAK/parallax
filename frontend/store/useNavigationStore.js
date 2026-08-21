import { create } from 'zustand';

const useNavigationStore = create((set, get) => ({
  currentPage: "home", // "home", "form", etc.
  currentStepIndex: 0,
  currentFieldId: null,
  lastAction: null,
  systemMessage: "Welcome to Lumina Assist. How can I help you today?",
  stepHistory: {}, // cache for step conversational history [{role, content}]

  setPage: (pageId) => {
    set({ currentPage: pageId, systemMessage: "" });
  },

  setStep: (stepIndex, message = "") => {
    set((state) => {
      const history = state.stepHistory[stepIndex] || [];
      const cachedMsg = history.length > 0 ? history[history.length - 1].content : null;
      return { 
        currentStepIndex: stepIndex, 
        systemMessage: message || cachedMsg || "" 
      };
    });
  },

  setField: (fieldId, message = "") => {
    set({ currentFieldId: fieldId, systemMessage: message });
  },

  addMessageToHistory: (stepIndex, role, content) => {
    set((state) => {
      const currentHistory = state.stepHistory[stepIndex] || [];
      return {
        stepHistory: {
          ...state.stepHistory,
          [stepIndex]: [...currentHistory, { role, content }]
        }
      };
    });
  },

  setSystemMessage: (message, bypassCache = false) => {
    set((state) => {
      if (state.currentPage === 'form' && !bypassCache && message) {
        const currentHistory = state.stepHistory[state.currentStepIndex] || [];
        return { 
          systemMessage: message, 
          stepHistory: { 
            ...state.stepHistory, 
            [state.currentStepIndex]: [...currentHistory, { role: 'assistant', content: message }] 
          } 
        };
      }
      return { systemMessage: message };
    });
  },

  setLastAction: (actionType) => {
    set({ lastAction: actionType });
  },

  nextStep: (totalSteps, message = "") => {
    set((state) => {
      if (state.currentStepIndex < totalSteps - 1) {
        const nextIndex = state.currentStepIndex + 1;
        const history = state.stepHistory[nextIndex] || [];
        const cachedMsg = history.length > 0 ? history[history.length - 1].content : null;
        return { currentStepIndex: nextIndex, systemMessage: message || cachedMsg || "" };
      }
      return { systemMessage: message || "You are already on the last step." };
    });
  },

  prevStep: (message = "") => {
    set((state) => {
      if (state.currentStepIndex > 0) {
        const prevIndex = state.currentStepIndex - 1;
        const history = state.stepHistory[prevIndex] || [];
        const cachedMsg = history.length > 0 ? history[history.length - 1].content : null;
        return { currentStepIndex: prevIndex, systemMessage: message || cachedMsg || "" };
      }
      return { systemMessage: message || "You are already on the first step." };
    });
  }
}));

export default useNavigationStore;
