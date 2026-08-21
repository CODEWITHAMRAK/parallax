"use client";

import React, { useState, useEffect, useRef } from "react";
import useNavigationStore from "../store/useNavigationStore.js";
import useFormStore from "../store/useFormStore.js";
import { fetchChatAction } from "../lib/apiService.js";
import { executeAction } from "../lib/actionDispatcher.js";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button.jsx";
import { useVoice, VoiceState } from "../hooks/useVoice.js";

// Simple inline SVG icons to avoid dependency issues
const MicIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
);

const StopIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <rect x="6" y="6" width="12" height="12" rx="2" ry="2" />
    </svg>
);

export default function TextNavigationUI({ inline = false }) {
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const { systemMessage, currentStepIndex, currentFieldId, currentPage } =
        useNavigationStore();
    const { schema, values } = useFormStore();
    const router = useRouter();

    const {
        state: voiceState,
        errorMsg: voiceError,
        language,
        setLanguage,
        interactionMode,
        setInteractionMode,
        startListening,
        pauseListening,
        speak,
        playSystemAudio,
        stopSpeaking,
    } = useVoice();

    const noResponseTimerRef = useRef(null);

    const startVoiceTurn = async () => {
        console.log("[TextNavUI Debug] startVoiceTurn called.");
        if (noResponseTimerRef.current)
            clearTimeout(noResponseTimerRef.current);

        await startListening(
            // onSpeechEndCallback (receives transcribed text directly!)
            async (transcribed) => {
                console.log("[TextNavUI Debug] onSpeechEndCallback fired from VAD!");
                if (noResponseTimerRef.current)
                    clearTimeout(noResponseTimerRef.current);
                if (transcribed) {
                    console.log(
                        `[TextNavUI Debug] Processing transcribed text: "${transcribed}"`,
                    );
                    setInput(transcribed);
                    await processInput(transcribed);
                } else {
                    console.warn(
                        "[TextNavUI Debug] Transcription failed or returned empty. Prompting user to repeat.",
                    );
                    await playSystemAudio("didnt_catch");
                    const currentMode = document.getElementById('interaction-mode-indicator')?.dataset?.mode;
                    if (currentMode === 'voice') startVoiceTurn();
                }
            },
            // onSpeechStart
            () => {
                console.log(
                    "[TextNavUI Debug] onSpeechStart callback fired! Clearing 5s no-response timer.",
                );
                if (noResponseTimerRef.current)
                    clearTimeout(noResponseTimerRef.current);
            },
        );

        noResponseTimerRef.current = setTimeout(async () => {
            console.log("[TextNavUI Debug] 5s no-response timer fired!");
            pauseListening(); // Manually pause the VAD because it never heard anything

            console.log("[TextNavUI Debug] Prompting 'Are you still there?'");
            await playSystemAudio("are_you_there");
            const currentMode = document.getElementById('interaction-mode-indicator')?.dataset?.mode;
            if (currentMode === 'voice') startVoiceTurn();
        }, 5000);
    };

    const processInput = async (textToProcess) => {
        if (!textToProcess.trim()) return;

        useNavigationStore
            .getState()
            .addMessageToHistory(currentStepIndex, "user", textToProcess);
        setLoading(true);

        try {
            const currentStep = schema ? schema.steps[currentStepIndex] : null;
            const currentField = currentStep
                ? currentStep.fields.find((f) => f.id === currentFieldId)
                : null;

            const context = {
                chat_history:
                    useNavigationStore.getState().stepHistory[
                        currentStepIndex
                    ] || [],
                current_page: currentPage,
                form_title: schema?.title,
                current_step: currentStep
                    ? {
                          id: currentStep.id,
                          title: currentStep.title,
                          fields: currentStep.fields,
                      }
                    : null,
                current_field: currentField
                    ? {
                          id: currentField.id,
                          label: currentField.label,
                          type: currentField.type,
                      }
                    : null,
                form_values: values,
                available_steps: schema ? schema.steps.map((s) => s.id) : [],
            };

            const action = await fetchChatAction(textToProcess, context);
            executeAction(action, router);

            // Explicitly speak only the LLM's direct conversational message
            if (action.message) {
                await speak(action.message);

                // If in voice mode, automatically start listening again after speaking
                // Use a 1500ms timeout to ensure speaker output completely finishes and echoes die down before mic activates
                setTimeout(() => {
                    // Check if we are still in voice mode
                    const currentMode = document.getElementById(
                        "interaction-mode-indicator",
                    )?.dataset?.mode;
                    if (currentMode === "voice") {
                        startVoiceTurn();
                    }
                }, 1500);
            }

            setInput("");
        } catch (error) {
            console.error(error);
            useNavigationStore
                .getState()
                .setSystemMessage(
                    "Sorry, I'm having trouble connecting right now.",
                );
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        await processInput(input);
    };

    const handleVoiceAction = async () => {
        if (voiceState === VoiceState.LISTENING || voiceState === VoiceState.PREPARING) {
            if (noResponseTimerRef.current) clearTimeout(noResponseTimerRef.current);
            pauseListening();
        } else if (voiceState === VoiceState.SPEAKING) {
            stopSpeaking();
            if (interactionMode === "voice") startVoiceTurn();
        } else {
            if (interactionMode === "voice") {
                startVoiceTurn();
            } else {
                // Manual mode
                startListening(async (transcribed) => {
                    if (transcribed) {
                        setInput(transcribed);
                        await processInput(transcribed);
                    }
                });
            }
        }
    };

    const toggleInteractionMode = () => {
        if (interactionMode === "text") {
            setInteractionMode("voice");
            startVoiceTurn();
        } else {
            setInteractionMode("text");
            if (noResponseTimerRef.current)
                clearTimeout(noResponseTimerRef.current);
            if (
                voiceState === VoiceState.LISTENING ||
                voiceState === VoiceState.PREPARING
            ) {
                pauseListening();
            }
            stopSpeaking();
        }
    };

    const isPreparing = voiceState === VoiceState.PREPARING;
    const isListening = voiceState === VoiceState.LISTENING;
    const isProcessing = voiceState === VoiceState.PROCESSING;
    const isSpeaking = voiceState === VoiceState.SPEAKING;
    const disableVoice = isProcessing || loading || isPreparing;

    const containerClasses = inline
        ? "w-full h-full flex flex-col justify-center bg-background"
        : "fixed bottom-0 left-0 w-full bg-background border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50 p-4 md:p-6";

    const innerClasses = inline
        ? "w-full flex flex-col gap-4"
        : "max-w-[800px] mx-auto flex flex-col gap-4";

    return (
        <div className={containerClasses}>
            <span
                id="interaction-mode-indicator"
                data-mode={interactionMode}
                className="hidden"
            ></span>
            <div className={innerClasses}>
                {/* Top Controls: Mode Switch, Language & Voice Error */}
                <div className="flex justify-between items-center text-sm mb-2 border-b border-border pb-4">
                    <button
                        onClick={toggleInteractionMode}
                        className={`px-4 py-2 rounded-full font-bold transition-all ${interactionMode === "voice" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >
                        {interactionMode === "voice"
                            ? "📞 Voice Call Mode"
                            : "💬 Text Chat Mode"}
                    </button>

                    <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="bg-muted text-foreground border-none rounded-md px-2 py-1 outline-none font-medium cursor-pointer"
                    >
                        <option value="en-IN">English (India)</option>
                        <option value="hi-IN">Hindi (India)</option>
                        <option value="kn-IN">Kannada (India)</option>
                    </select>
                </div>

                {voiceError && (
                    <div className="text-error font-medium text-center">
                        {voiceError}
                    </div>
                )}

                {!voiceError && interactionMode === "voice" && (
                    <div className="text-center mb-6">
                        <span className="text-muted-foreground font-medium text-lg">
                            {isPreparing
                                ? "Warming up mic..."
                                : isListening
                                  ? "🎙 Listening... (Speak now)"
                                  : isProcessing
                                    ? "Processing..."
                                    : isSpeaking
                                      ? "🔊 Assistant Speaking..."
                                      : "Call Paused. Tap mic to resume."}
                        </span>
                    </div>
                )}

                {/* System Message */}
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <span className="text-primary-foreground font-bold text-xl">
                            LA
                        </span>
                    </div>
                    <div className="flex-1 bg-muted rounded-2xl p-4 md:p-5 rounded-tl-sm text-foreground text-xl font-medium shadow-sm">
                        {loading ? (
                            <span className="animate-pulse">Loading...</span>
                        ) : systemMessage ? (
                            systemMessage
                        ) : (
                            <span className="animate-pulse">Loading...</span>
                        )}
                    </div>
                </div>

                {/* Voice & Text Input */}
                <div
                    className={`flex flex-col md:flex-row gap-4 items-center ${interactionMode === "voice" ? "mt-8" : "mt-2"}`}
                >
                    {/* Prominent Voice Button */}
                    <button
                        onClick={handleVoiceAction}
                        disabled={disableVoice}
                        className={`rounded-full flex items-center justify-center transition-all shadow-md shrink-0 
              ${interactionMode === "voice" ? "w-24 h-24 md:w-32 md:h-32" : "w-20 h-20 md:w-24 md:h-24"}
              ${
                  isPreparing
                      ? "bg-muted text-muted-foreground cursor-wait"
                      : isListening
                        ? "bg-primary text-primary-foreground animate-pulse scale-110 shadow-lg shadow-primary/20"
                        : isSpeaking
                          ? "bg-secondary text-secondary-foreground shadow-lg shadow-secondary/20"
                          : "bg-primary text-primary-foreground hover:scale-105"
              } 
              ${disableVoice ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                        aria-label={
                            isListening
                                ? "Stop Listening"
                                : isSpeaking
                                  ? "Stop Speaking"
                                  : "Start Voice Input"
                        }
                    >
                        {isListening || isSpeaking ? <StopIcon /> : <MicIcon />}
                    </button>

                    {/* Text Input (Secondary) - Hidden in Voice Mode */}
                    {interactionMode === "text" && (
                        <form
                            onSubmit={handleSubmit}
                            className="flex gap-2 w-full md:flex-1 relative"
                        >
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Type your response here..."
                                disabled={loading || isListening}
                                className="w-full bg-muted border-none rounded-xl px-4 py-4 pr-16 outline-none focus:ring-2 focus:ring-primary text-lg"
                            />
                            <button
                                type="submit"
                                disabled={
                                    loading || !input.trim() || isListening
                                }
                                className="absolute right-2 top-2 bottom-2 bg-primary text-primary-foreground px-4 rounded-lg font-bold disabled:opacity-50 transition-colors hover:bg-primary/90"
                            >
                                Send
                            </button>
                        </form>
                    )}

                    {interactionMode === "voice" && (
                        <button
                            onClick={toggleInteractionMode}
                            className="mt-4 px-6 py-3 rounded-full bg-error/10 text-error font-bold hover:bg-error/20 transition-colors"
                        >
                            End Call
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
