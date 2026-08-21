import useFormStore from '../store/useFormStore.js';
import useNavigationStore from '../store/useNavigationStore.js';
import { ACTIONS } from './navigation.js';
import { validateField } from './validation.js';

export const executeAction = (action, router) => {
  const formStore = useFormStore.getState();
  const navStore = useNavigationStore.getState();
  
  navStore.setLastAction(action.action);

  if (!action.action) {
    navStore.setSystemMessage("I didn't understand that. Could you please rephrase?");
    return;
  }

  const { schema, values } = formStore;

  switch (action.action) {
    case ACTIONS.NAVIGATE_PAGE:
      if (action.target === 'home') {
        navStore.setPage('home');
        router.push('/');
        navStore.setSystemMessage("Taking you to the home page.");
      } else if (action.target === 'scholarship_application' || action.target === 'form') {
        navStore.setPage('form');
        router.push('/form/scholarship_application');
        navStore.setSystemMessage("Opening the scholarship form.");
      }
      break;

    case ACTIONS.NAVIGATE_STEP:
      if (!schema) return navStore.setSystemMessage("No active form.");
      const stepIndex = schema.steps.findIndex(s => s.id === action.target);
      if (stepIndex !== -1) {
        navStore.setStep(stepIndex, `Navigated to ${schema.steps[stepIndex].title}.`);
      } else {
        navStore.setSystemMessage("I couldn't find that step.");
      }
      break;

    case ACTIONS.NEXT:
      if (!schema) return;
      const currentStep = schema.steps[navStore.currentStepIndex];
      // Check required fields
      let missingField = null;
      for (const field of currentStep.fields) {
        if (field.required && !values[field.id]) {
          missingField = field;
          break;
        }
      }
      if (missingField) {
        navStore.setSystemMessage(`Your ${missingField.label} is still missing. Please provide it before moving next.`);
      } else {
        navStore.nextStep(schema.steps.length, `Moving to the next step: ${schema.steps[Math.min(navStore.currentStepIndex + 1, schema.steps.length - 1)].title}.`);
      }
      break;

    case ACTIONS.PREVIOUS:
      if (!schema) return;
      navStore.prevStep("Moving to the previous step.");
      break;

    case ACTIONS.FILL_FIELD:
    case ACTIONS.SELECT_OPTION:
      if (!schema) return;
      // Find field
      let targetField = null;
      for (const step of schema.steps) {
        targetField = step.fields.find(f => f.id === action.field);
        if (targetField) break;
      }
      if (targetField) {
        const validation = validateField(targetField, action.value);
        if (validation.valid) {
          formStore.updateValue(action.field, action.value, true);
          navStore.setSystemMessage(`Got it. Set ${targetField.label} to ${action.value}.`);
        } else {
          navStore.setSystemMessage(`Invalid value: ${validation.error}`);
        }
      } else {
        navStore.setSystemMessage("I couldn't find that field.");
      }
      break;

    case ACTIONS.CLEAR_FIELD:
      formStore.clearValue(action.field);
      navStore.setSystemMessage(`Cleared the value for ${action.field}.`);
      break;

    case ACTIONS.EXPLAIN_FIELD:
      if (!schema) return;
      let expField = null;
      for (const step of schema.steps) {
        expField = step.fields.find(f => f.id === action.field);
        if (expField) break;
      }
      if (expField) {
        navStore.setSystemMessage(`Explanation for ${expField.label}: ${expField.description || 'This field is required for your application.'}`);
      }
      break;

    case ACTIONS.SUBMIT:
      navStore.setSystemMessage("Submitting your application...");
      // Handle submission logic (API call)
      break;

    default:
      navStore.setSystemMessage("I'm not sure how to do that.");
      break;
  }
};
