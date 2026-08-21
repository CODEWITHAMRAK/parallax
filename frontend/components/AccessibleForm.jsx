"use client";

import React, { useEffect } from "react";
import useFormStore from "../store/useFormStore.js";
import useNavigationStore from "../store/useNavigationStore.js";
import { Button } from "./ui/button.jsx";
import { executeAction } from "../lib/actionDispatcher.js";
import { useRouter } from "next/navigation";
import { ACTIONS } from "../lib/navigation.js";
import { fetchChatAction, getDraft, saveDraft } from "../lib/apiService.js";

export default function AccessibleForm({ formId }) {
  const { schema, values, completed, loadSchema, loadingSchema, error, draftLoaded } = useFormStore();
  const { currentStepIndex, currentFieldId, stepHistory, setSystemMessage } = useNavigationStore();
  const router = useRouter();

  useEffect(() => {
    const initForm = async () => {
      if (!formId) return;
      await loadSchema(formId);
      try {
        const draftData = await getDraft(formId);
        if (draftData && draftData.draft) {
          useFormStore.setState(state => ({ 
            values: { ...state.values, ...draftData.draft.values } 
          }));
          if (draftData.draft.currentStepIndex !== undefined) {
            useNavigationStore.getState().setStep(draftData.draft.currentStepIndex);
          }
        }
      } catch (e) {
        console.error("Failed to load draft", e);
      } finally {
        useFormStore.setState({ draftLoaded: true });
      }
    };
    initForm();
  }, [formId, loadSchema]);

  // Auto-save progress
  useEffect(() => {
    if (schema && formId) {
      const timer = setTimeout(() => {
        saveDraft(formId, values, currentStepIndex).catch(e => console.error("Auto-save failed", e));
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [values, currentStepIndex, schema, formId]);

  const fetchingRef = React.useRef(false);

  // Conversational auto-greeting when entering a step for the first time
  useEffect(() => {
    if (schema && schema.steps[currentStepIndex] && (!stepHistory || !stepHistory[currentStepIndex]) && draftLoaded && !fetchingRef.current) {
      fetchingRef.current = true;
      setSystemMessage("", true); // Clear stale message instantly (bypass cache) to show loading state
      const fetchGreeting = async () => {
        try {
          const currentStep = schema.steps[currentStepIndex];
          const context = {
            current_page: 'form',
            form_title: schema.title,
            current_step: { id: currentStep.id, title: currentStep.title, fields: currentStep.fields },
            form_values: useFormStore.getState().values,
            available_steps: schema.steps.map(s => s.id)
          };
          const action = await fetchChatAction("I just entered this step. Please greet me and ask for the first missing field.", context);
          if (action.message) {
            setSystemMessage(action.message);
          }
        } catch (e) {
          console.error("Failed to auto-fetch greeting", e);
        } finally {
          fetchingRef.current = false;
        }
      };
      fetchGreeting();
    }
  }, [currentStepIndex, schema, stepHistory, setSystemMessage, draftLoaded]);

  if (loadingSchema) {
    return <div className="p-8 text-xl animate-pulse text-primary">Loading form details...</div>;
  }

  if (error) {
    return <div className="p-8 text-xl text-destructive">Error: {error}</div>;
  }

  if (!schema) return null;

  const currentStep = schema.steps[currentStepIndex];
  if (!currentStep) return null;

  const handleNext = () => executeAction({ action: ACTIONS.NEXT }, router);
  const handlePrev = () => executeAction({ action: ACTIONS.PREVIOUS }, router);

  return (
    <div className="w-full max-w-[800px] mx-auto p-4 md:p-8 bg-card rounded-2xl shadow-[0_4px_20px_rgba(0,52,65,0.15)] min-h-[500px] flex flex-col justify-between">
      <div>
        <div className="mb-8">
          <p className="font-heading text-sm text-muted-foreground mb-2 tracking-widest uppercase font-bold">
            Step {currentStepIndex + 1} of {schema.steps.length}
          </p>
          <h2 className="font-heading text-3xl font-semibold text-primary">{currentStep.title}</h2>
        </div>

        <div className="space-y-6">
          {currentStep.fields.map(field => {
            const isFocused = currentFieldId === field.id;
            return (
              <div key={field.id} className="flex flex-col gap-2">
                <label 
                  htmlFor={field.id} 
                  className="font-heading text-xl font-semibold text-foreground"
                >
                  {field.label} {field.required && <span className="text-destructive">*</span>}
                </label>
                
                {field.type === 'select' ? (
                  <select
                    id={field.id}
                    value={values[field.id] || ""}
                    readOnly
                    className={`h-[64px] rounded-lg px-4 bg-input text-xl text-foreground border-b-2 outline-none transition-all ${
                      isFocused ? "border-primary border-2" : "border-border"
                    }`}
                  >
                    <option value="" disabled>Select an option...</option>
                    {field.options?.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={field.id}
                    type={field.type}
                    value={values[field.id] || ""}
                    readOnly
                    className={`h-[64px] rounded-lg px-4 bg-input text-xl text-foreground border-b-2 outline-none transition-all ${
                      isFocused ? "border-primary border-2" : "border-border"
                    }`}
                  />
                )}
                
                {field.description && (
                  <p className="text-lg text-muted-foreground">{field.description}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="mt-12 flex justify-between">
        <Button 
          variant="outline" 
          onClick={handlePrev} 
          disabled={currentStepIndex === 0}
          className="h-[56px] px-8 text-xl text-primary border-2 border-primary rounded-lg font-semibold hover:bg-muted"
        >
          Back
        </Button>
        <Button 
          onClick={handleNext}
          className="h-[56px] px-8 text-xl bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 shadow-none"
        >
          {currentStepIndex === schema.steps.length - 1 ? 'Review & Submit' : 'Next Step'}
        </Button>
      </div>
    </div>
  );
}
