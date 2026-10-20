import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useNavigationStore = create(
  persist(
    (set, get) => ({
      currentPage: "home", // "home", "form", etc.
      language: "English", // default language
      currentStepIndex: 0,
      currentFieldId: null,
      lastAction: null,
      systemMessage: "Welcome to Parallax. How can I help you today?",
      stepHistory: {}, // cache for step conversational history [{role, content}]
      availableForms: [], // store titles of available forms

      setAvailableForms: (forms) => set({ availableForms: forms }),
      setLanguage: (lang) => set({ language: lang }),

      setPage: (pageId) => {
        set({ currentPage: pageId, systemMessage: "" });
      },

      setStep: (stepIndex, message = "") => {
        set((state) => {
          const history = state.stepHistory[stepIndex] || [];
          const assistantMsgs = history.filter(m => m.role === 'assistant');
          const cachedMsg = assistantMsgs.length > 0 ? assistantMsgs[assistantMsgs.length - 1].content : null;
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
          if (state.currentPage !== 'form') return state;
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

      appendSystemMessage: (messageChunk) => {
        set((state) => {
          const newMsg = state.systemMessage && state.systemMessage !== "Loading..." && state.systemMessage !== "Processing..." 
              ? state.systemMessage + " " + messageChunk 
              : messageChunk;
          return { systemMessage: newMsg };
        });
      },

      setLastAction: (actionType) => {
        set({ lastAction: actionType });
      },

      nextStep: (totalSteps, message = "") => {
        set((state) => {
          if (state.currentStepIndex < totalSteps) {
            const nextIndex = state.currentStepIndex + 1;
            const history = state.stepHistory[nextIndex] || [];
            const assistantMsgs = history.filter(m => m.role === 'assistant');
            const cachedMsg = assistantMsgs.length > 0 ? assistantMsgs[assistantMsgs.length - 1].content : null;
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
            const assistantMsgs = history.filter(m => m.role === 'assistant');
            const cachedMsg = assistantMsgs.length > 0 ? assistantMsgs[assistantMsgs.length - 1].content : null;
            return { currentStepIndex: prevIndex, systemMessage: message || cachedMsg || "" };
          }
          return { systemMessage: message || "You are already on the first step." };
        });
      },

      resetNavigation: (message = "") => {
        set({
          currentStepIndex: 0,
          currentFieldId: null,
          stepHistory: {},
          systemMessage: message
        });
      }
    }),
    {
      name: 'navigation-storage',
      partialize: (state) => ({ language: state.language }),
    }
  )
);

export default useNavigationStore;
