"use client";

import React, { useState } from "react";
import useNavigationStore from "../store/useNavigationStore.js";
import useFormStore from "../store/useFormStore.js";
import { fetchChatAction } from "../lib/apiService.js";
import { executeAction } from "../lib/actionDispatcher.js";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button.jsx";

export default function TextNavigationUI() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { systemMessage, currentStepIndex, currentFieldId, currentPage } = useNavigationStore();
  const { schema, values } = useFormStore();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    setLoading(true);
    
    try {
      const currentStep = schema ? schema.steps[currentStepIndex] : null;
      const currentField = currentStep ? currentStep.fields.find(f => f.id === currentFieldId) : null;
      
      const context = {
        current_page: currentPage,
        form_title: schema?.title,
        current_step: currentStep ? { id: currentStep.id, title: currentStep.title } : null,
        current_field: currentField ? { id: currentField.id, label: currentField.label, type: currentField.type } : null,
        form_values: values,
        available_steps: schema ? schema.steps.map(s => s.id) : []
      };

      const action = await fetchChatAction(input, context);
      executeAction(action, router);
      setInput("");
    } catch (error) {
      console.error(error);
      useNavigationStore.getState().setSystemMessage("Sorry, I'm having trouble connecting right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 w-full bg-background border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50">
      <div className="max-w-[800px] mx-auto p-4 md:p-6 flex flex-col gap-4">
        
        {/* System Message */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-xl">LA</span>
          </div>
          <div className="flex-1 bg-muted rounded-2xl p-4 md:p-5 rounded-tl-sm text-foreground text-xl font-medium">
            {loading ? (
              <span className="animate-pulse">Thinking...</span>
            ) : (
              systemMessage || "I'm ready to help."
            )}
          </div>
        </div>

        {/* User Input */}
        <form onSubmit={handleSubmit} className="flex gap-4 items-end relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type here to navigate or fill the form..."
            className="flex-1 h-[64px] rounded-full px-6 bg-input text-xl text-foreground focus:outline-none focus:ring-4 focus:ring-primary/20 border-2 border-border focus:border-primary transition-all shadow-sm"
          />
          <Button 
            type="submit" 
            disabled={loading || !input.trim()}
            className="absolute right-2 top-2 bottom-2 h-auto px-8 rounded-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 text-xl"
          >
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
