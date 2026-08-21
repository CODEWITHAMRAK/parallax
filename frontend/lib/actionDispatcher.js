import useFormStore from '../store/useFormStore.js';
import useNavigationStore from '../store/useNavigationStore.js';
import { ACTIONS } from './navigation.js';
import { validateField } from './validation.js';

export const executeAction = (action, router) => {
  const formStore = useFormStore.getState();
  const navStore = useNavigationStore.getState();
  
  navStore.setLastAction(action.action);

  if (!action.action) {
    navStore.setSystemMessage(action.message || "I didn't understand that. Could you please rephrase?");
    return;
  }

  const { schema, values } = formStore;

  switch (action.action) {
    case 'CHAT':
      navStore.setSystemMessage(action.message || "I'm here to help.");
      break;

    case ACTIONS.NAVIGATE_PAGE:
      if (action.target === 'home') {
        navStore.setPage('home');
        router.push('/');
        navStore.setSystemMessage(action.message || "Taking you to the home page.");
      } else if (action.target === 'scholarship_application' || action.target === 'form' || action.target === 'scholarship_form') {
        navStore.setPage('form');
        router.push('/form/scholarship_application');
        navStore.setSystemMessage(action.message || "Opening the scholarship form.", true);
      } else {
        navStore.setSystemMessage(action.message || `I couldn't find the page: ${action.target}`);
      }
      break;

    case ACTIONS.NAVIGATE_STEP:
      if (!schema) return navStore.setSystemMessage("No active form.");
      const stepIndex = schema.steps.findIndex(s => s.id === action.target);
      if (stepIndex !== -1) {
        navStore.setStep(stepIndex);
        if (action.message) navStore.setSystemMessage(action.message);
      } else {
        navStore.setSystemMessage(action.message || "I couldn't find that step.");
      }
      break;

    case ACTIONS.NEXT:
      if (!schema) return;
      const currentStep = schema.steps[navStore.currentStepIndex];
      let missingField = null;
      for (const field of currentStep.fields) {
        if (field.required && !values[field.id]) {
          missingField = field;
          break;
        }
      }
      if (missingField) {
        navStore.setSystemMessage(action.message || `Your ${missingField.label} is still missing. Please provide it before moving next.`);
      } else {
        navStore.nextStep(schema.steps.length);
        if (action.message) navStore.setSystemMessage(action.message);
      }
      break;

    case ACTIONS.PREVIOUS:
      if (!schema) return;
      navStore.prevStep();
      if (action.message) navStore.setSystemMessage(action.message);
      break;

    case ACTIONS.FILL_FIELD:
    case ACTIONS.SELECT_OPTION:
      if (!schema) return;
      let targetField = null;
      for (const step of schema.steps) {
        targetField = step.fields.find(f => f.id === action.field);
        if (targetField) break;
      }
      if (targetField) {
        const validation = validateField(targetField, action.value);
        if (validation.valid) {
          formStore.updateValue(action.field, action.value, true);
          navStore.setSystemMessage(action.message || `Got it. Set ${targetField.label} to ${action.value}.`);
        } else {
          navStore.setSystemMessage(`Invalid value: ${validation.error}`);
        }
      } else {
        navStore.setSystemMessage(action.message || "I couldn't find that field.");
      }
      break;

    case ACTIONS.CLEAR_FIELD:
      formStore.clearValue(action.field);
      navStore.setSystemMessage(action.message || `Cleared the value for ${action.field}.`);
      break;

    case ACTIONS.EXPLAIN_FIELD:
      navStore.setSystemMessage(action.message || "I can explain this field.");
      break;

    case ACTIONS.SUBMIT:
      navStore.setSystemMessage(action.message || "Submitting your application...");
      // Handle submission logic (API call)
      break;

    default:
      navStore.setSystemMessage(action.message || "I'm not sure how to do that.");
      break;
  }
};
