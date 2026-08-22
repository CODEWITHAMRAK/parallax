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

  // 1. Universally process any extracted fields, regardless of the main action
  if (action.filled_fields && typeof action.filled_fields === 'object' && schema) {
    Object.entries(action.filled_fields).forEach(([fieldId, value]) => {
      let targetField = null;
      for (const step of schema.steps) {
        targetField = step.fields.find(f => f.id === fieldId);
        if (targetField) break;
      }
      
      if (targetField) {
        const validation = validateField(targetField, value);
        if (validation.valid) {
          formStore.updateValue(fieldId, value, true);
        } else {
          console.warn(`[ActionDispatcher] Validation failed for ${fieldId}: ${validation.error}`);
        }
      }
    });
  }

  switch (action.action) {
    case 'CHAT':
      navStore.setSystemMessage(action.message || "I'm here to help.");
      break;

    case ACTIONS.NAVIGATE_PAGE:
      if (action.target === 'home') {
        navStore.setPage('home');
        router.push('/home');
        navStore.setSystemMessage(action.message || "Navigating home.");
      } else if (action.target === 'scholarship_application' || action.target === 'national_scholarship' || action.target === 'scholarship' || action.target === 'scholarship_form') {
        navStore.setPage('form');
        router.push('/form/national_scholarship');
        navStore.setSystemMessage(action.message || "Opening National Scholarship Form.", true);
      } else if (action.target === 'education_loan' || action.target === 'loan' || action.target === 'loan_form') {
        navStore.setPage('form');
        router.push('/form/education_loan');
        navStore.setSystemMessage(action.message || "Opening Education Loan Form.", true);
      } else if (action.target === 'bus_pass' || action.target === 'bus_pass_application' || action.target === 'bus_pass_form') {
        navStore.setPage('form');
        router.push('/form/bus_pass');
        navStore.setSystemMessage(action.message || "Opening Student Bus Pass Application.", true);
      } else if (action.target) {
        const cleanTarget = action.target.replace(/^\/form\//, '');
        navStore.setPage('form');
        router.push(`/form/${cleanTarget}`);
        navStore.setSystemMessage(action.message || `Opening ${cleanTarget}.`, true);
      } else {
        navStore.setSystemMessage(action.message || "Page not found.");
      }
      break;

    case ACTIONS.NAVIGATE_STEP:
      if (!schema) return navStore.setSystemMessage(t('no_active_form'));
      const stepIndex = schema.steps.findIndex(s => s.id === action.target);
      if (stepIndex !== -1) {
        // Prevent jumping forward if current step has missing required fields
        if (stepIndex > navStore.currentStepIndex) {
          const currentStep = schema.steps[navStore.currentStepIndex];
          let missingField = null;
          for (const field of currentStep.fields) {
            if (field.required && !values[field.id]) {
              missingField = field;
              break;
            }
          }
          if (missingField) {
            navStore.setSystemMessage(action.message || t('missing_field_warning', { label: missingField.label }));
            break;
          }
        }
        
        navStore.setStep(stepIndex);
        if (action.message) navStore.setSystemMessage(action.message);
      } else {
        navStore.setSystemMessage(action.message || t('step_not_found'));
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
        navStore.setSystemMessage(action.message || t('missing_field_next', { label: missingField.label }));
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
      // Values are already updated by the universal extractor above
      navStore.setSystemMessage(action.message || t('form_updated'));
      break;

    case ACTIONS.CLEAR_FIELD:
      if (!action.target || action.target === 'all') {
        formStore.resetForm();
        navStore.setSystemMessage(action.message || t('cleared_all'));
      } else {
        formStore.clearValue(action.target);
        navStore.setSystemMessage(action.message || t('cleared_field', { target: action.target }));
      }
      break;

    case ACTIONS.EXPLAIN_FIELD:
      navStore.setSystemMessage(action.message || t('explain_field_default'));
      break;

    case ACTIONS.SUBMIT:
      navStore.setSystemMessage(action.message || t('submitting_application'));
      // Handle submission logic (API call)
      break;

    case ACTIONS.RESTART_FORM:
      formStore.resetForm();
      navStore.resetNavigation(action.message || t('form_restarted'));
      break;

    case ACTIONS.OPEN_SCANNER:
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('trigger-scanner', { detail: { target: action.target } }));
      }
      if (action.message) navStore.setSystemMessage(action.message);
      break;

    case ACTIONS.OPEN_FILE_PICKER:
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('trigger-file-picker', { detail: { target: action.target } }));
      }
      if (action.message) navStore.setSystemMessage(action.message);
      break;

    default:
      navStore.setSystemMessage(action.message || "I'm not sure how to do that.");
      break;
  }
};
