import { create } from 'zustand';
import { fetchFormSchema } from '../lib/apiService.js';

const useFormStore = create((set, get) => ({
  schema: null,
  values: {},
  completed: {},
  loadingSchema: false,
  error: null,

  loadSchema: async (formId) => {
    set({ loadingSchema: true, error: null });
    try {
      const schema = await fetchFormSchema(formId);
      // Initialize values and completed
      const initialValues = {};
      const initialCompleted = {};
      schema.steps.forEach(step => {
        step.fields.forEach(field => {
          initialValues[field.id] = "";
          initialCompleted[field.id] = false;
        });
      });
      set({ 
        schema, 
        values: initialValues, 
        completed: initialCompleted,
        loadingSchema: false 
      });
    } catch (err) {
      set({ error: err.message, loadingSchema: false });
    }
  },

  updateValue: (fieldId, value, isValid = true) => {
    set((state) => ({
      values: { ...state.values, [fieldId]: value },
      completed: { ...state.completed, [fieldId]: isValid }
    }));
  },

  clearValue: (fieldId) => {
    set((state) => ({
      values: { ...state.values, [fieldId]: "" },
      completed: { ...state.completed, [fieldId]: false }
    }));
  }
}));

export default useFormStore;
