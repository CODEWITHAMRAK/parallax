"use client";

import React, { useState, useEffect, useRef } from "react";
import useNavigationStore from "../store/useNavigationStore.js";
import useFormStore from "../store/useFormStore.js";
import { fetchChatAction, fetchChatActionStream } from "../lib/apiService.js";
import { executeAction } from "../lib/actionDispatcher.js";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button.jsx";
import { useVoice, VoiceState } from "../hooks/useVoice.js";
import { voiceService } from "../lib/voiceService.js";
import useLocalizationStore from "../store/useLocalizationStore.js";

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

export default function TextNavigationUI({
    inline = false,
    isHomeVoiceOnly = false,
}) {
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const { systemMessage, currentStepIndex, currentFieldId, currentPage } =
        useNavigationStore();
    const { schema, values } = useFormStore();
    const router = useRouter();
    const t = useLocalizationStore((state) => state.t);

    const {
        state: voiceState,
        errorMsg: voiceError,
        interactionMode,
        setInteractionMode,
        startListening,
        pauseListening,
        speak,
        queueSpeak,
        waitForSpeakQueue,
        playSystemAudio,
        stopSpeaking,
    } = useVoice();

    const noResponseTimerRef = useRef(null);
    const isTimeoutRef = useRef(false);

    useEffect(() => {
        const handleStartVoice = () => {
            const currentMode = document.getElementById(
                "interaction-mode-indicator",
            )?.dataset?.mode;
            if (currentMode === "voice") {
                startVoiceTurn();
            }
        };
        window.addEventListener("start-voice-turn", handleStartVoice);
        return () =>
            window.removeEventListener("start-voice-turn", handleStartVoice);
    }, []);

    const startVoiceTurn = async () => {
        console.log("[TextNavUI Debug] startVoiceTurn called.");
        if (voiceService.isSpeaking) {
            console.log(
                "[TextNavUI Debug] AI is currently speaking (or preparing to speak), aborting startVoiceTurn to prevent interruption.",
            );
            return;
        }

        if (noResponseTimerRef.current)
            clearTimeout(noResponseTimerRef.current);

        isTimeoutRef.current = false;

        await startListening(
            // onSpeechEndCallback (receives transcribed text directly!)
            async (transcribed) => {
                console.log(
                    "[TextNavUI Debug] onSpeechEndCallback fired from VAD!",
                );
                if (noResponseTimerRef.current)
                    clearTimeout(noResponseTimerRef.current);

                if (isTimeoutRef.current) {
                    console.log(
                        "[TextNavUI Debug] Ignoring VAD end because of 8s timeout.",
                    );
                    return;
                }

                if (transcribed) {
                    console.log(
                        `[TextNavUI Debug] Processing transcribed text: "${transcribed}"`,
                    );
                    setInput(transcribed);
                    await processInput(transcribed);
                } else {
                    console.warn(
                        "[TextNavUI Debug] Transcription failed or returned empty. Prompting user with didnt_catch audio.",
                    );
                    const msg = t("didnt_catch");
                    useNavigationStore.getState().setSystemMessage(msg);
                    await playSystemAudio("didnt_catch");
                    const currentMode = document.getElementById(
                        "interaction-mode-indicator",
                    )?.dataset?.mode;
                    if (currentMode === "voice") {
                        setTimeout(
                            () =>
                                window.dispatchEvent(
                                    new Event("start-voice-turn"),
                                ),
                            300,
                        );
                    }
                }
            },
            // onSpeechStart
            () => {
                console.log(
                    "[TextNavUI Debug] onSpeechStart callback fired! Clearing silence timer.",
                );
                if (noResponseTimerRef.current)
                    clearTimeout(noResponseTimerRef.current);
            },
        );

        noResponseTimerRef.current = setTimeout(async () => {
            console.log(
                "[TextNavUI Debug] 15s silence timer fired! Triggering are_you_there.",
            );
            isTimeoutRef.current = true;
            pauseListening(false); // Manually pause VAD without submitting noise

            console.log("[TextNavUI Debug] Prompting 'Are you still there?'");
            const msg = t("still_there");
            useNavigationStore.getState().setSystemMessage(msg);
            await playSystemAudio("are_you_there");
            const currentMode = document.getElementById(
                "interaction-mode-indicator",
            )?.dataset?.mode;
            if (currentMode === "voice") {
                setTimeout(
                    () => window.dispatchEvent(new Event("start-voice-turn")),
                    300,
                );
            }
        }, 8000);
    };

    const processInput = async (textToProcess) => {
        if (!textToProcess.trim()) return;

        const normalized = textToProcess
            .trim()
            .toLowerCase()
            .replace(/[^a-z]/g, "");
        if (
            ["okay", "ok", "thankyou", "you"].includes(normalized) &&
            textToProcess.trim().split(/\s+/).length <= 2
        ) {
            console.warn(
                "[TextNavUI Debug] Ignoring likely STT silence hallucination: ",
                textToProcess,
            );
            const currentMode = document.getElementById(
                "interaction-mode-indicator",
            )?.dataset?.mode;
            if (currentMode === "voice")
                window.dispatchEvent(new Event("start-voice-turn"));
            return;
        }

        const navState = useNavigationStore.getState();
        const formState = useFormStore.getState();

        navState.addMessageToHistory(
            navState.currentStepIndex,
            "user",
            textToProcess,
        );
        setLoading(true);

        try {
            const isFormPage =
                navState.currentPage === "form" ||
                (typeof window !== "undefined" &&
                    window.location.pathname.includes("/form/"));
            const isReviewStep =
                isFormPage &&
                formState.schema &&
                navState.currentStepIndex === formState.schema.steps.length;
            const currentStep = isReviewStep
                ? { id: "review_step", title: "Review & Submit", fields: [] }
                : isFormPage && formState.schema
                  ? formState.schema.steps[navState.currentStepIndex]
                  : null;
            const currentField =
                isFormPage && currentStep
                    ? currentStep.fields.find(
                          (f) => f.id === navState.currentFieldId,
                      )
                    : null;

            const context = {
                chat_history: isFormPage
                    ? navState.stepHistory[navState.currentStepIndex] || []
                    : [],
                current_page: isFormPage ? "form" : "home",
                form_title: formState.schema?.title,
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
                form_values: isFormPage ? formState.values : {},
                available_steps:
                    isFormPage && formState.schema
                        ? [
                              ...formState.schema.steps.map((s) => s.id),
                              "review_step",
                          ]
                        : [],
                available_forms: isFormPage ? [] : navState.availableForms,
                language: navState.language,
            };

            const action = await fetchChatActionStream(
                textToProcess,
                context,
                (sentence) => {
                    const currentMode = document.getElementById(
                        "interaction-mode-indicator",
                    )?.dataset?.mode;
                    if (currentMode === "voice") {
                        queueSpeak(sentence, () => setLoading(false));
                    }
                    navState.appendSystemMessage(sentence);
                    setLoading(false);
                },
            );
            const currentMode = document.getElementById(
                "interaction-mode-indicator",
            )?.dataset?.mode;

            // Explicitly speak only if in voice mode
            if (action && action.message && currentMode === "voice") {
                const actionName = action.action?.trim()?.toUpperCase();
                const isScannerAction =
                    actionName === "OPEN_SCANNER" ||
                    actionName === "OPEN_FILE_PICKER" ||
                    actionName === "UPLOAD_DOCUMENT";

                // Always execute immediately so UI responds while speaking, even for scanner
                executeAction(action, router);

                await waitForSpeakQueue();

                if (isScannerAction) {
                    setLoading(false);
                } else {
                    setLoading(false);
                    const modeAfterSpeak = document.getElementById(
                        "interaction-mode-indicator",
                    )?.dataset?.mode;
                    if (modeAfterSpeak === "voice") {
                        window.dispatchEvent(new Event("start-voice-turn"));
                    }
                }
            } else if (action) {
                executeAction(action, router);
                setLoading(false);
            }

            setInput("");
        } catch (error) {
            if (error.message === "INTERRUPTED") {
                console.log(
                    "[TextNavUI] TTS interrupted. Aborting voice turn trigger.",
                );
                return;
            }
            console.error(error);
            useNavigationStore
                .getState()
                .setSystemMessage(t("connection_trouble"));
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        await processInput(input);
    };

    const handleVoiceAction = async () => {
        if (
            voiceState === VoiceState.LISTENING ||
            voiceState === VoiceState.PREPARING
        ) {
            if (noResponseTimerRef.current)
                clearTimeout(noResponseTimerRef.current);
            if (interactionMode === "voice") {
                isTimeoutRef.current = true;
                pauseListening(false);
            } else {
                pauseListening(true);
            }
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
    const [isMobileCollapsed, setIsMobileCollapsed] = useState(false);

    const containerClasses = inline
        ? "w-full h-full flex flex-col justify-center bg-transparent"
        : isHomeVoiceOnly
          ? "fixed bottom-8 left-0 right-0 w-full z-50 px-4 pointer-events-none [&>*]:pointer-events-auto flex justify-center"
          : "fixed bottom-0 left-0 w-full bg-background border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50 p-3 md:p-6";

    const innerClasses = inline
        ? "w-full flex flex-col gap-2 md:gap-4"
        : "max-w-[800px] mx-auto flex flex-col gap-2 md:gap-4";

    return (
        <div className={containerClasses}>
            <span
                id="interaction-mode-indicator"
                data-mode={interactionMode}
                className="hidden"
            ></span>

            {/* Mobile Minimized Floating Pill */}
            {inline && isMobileCollapsed ? (
                <div className="lg:hidden flex items-center justify-between gap-3 w-full py-1">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0 p-1">
                            <img
                                src="/logo.png"
                                alt="Parallax"
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <p className="text-xs text-slate-700 font-medium truncate">
                            {isListening
                                ? "Listening..."
                                : isProcessing || loading
                                  ? "Processing..."
                                  : isSpeaking
                                    ? "Speaking..."
                                    : systemMessage || "Assistant ready"}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={handleVoiceAction}
                            disabled={disableVoice}
                            className={`w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md transition-all ${
                                isListening
                                    ? "bg-primary animate-pulse scale-105"
                                    : "bg-[#003441]"
                            }`}
                            aria-label="Toggle Voice"
                        >
                            {isListening || isSpeaking ? (
                                <StopIcon />
                            ) : (
                                <MicIcon />
                            )}
                        </button>

                        <button
                            onClick={() => setIsMobileCollapsed(false)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors"
                        >
                            Expand ▲
                        </button>
                    </div>
                </div>
            ) : isHomeVoiceOnly ? (
                <div className="w-full max-w-[800px] bg-card border-2 border-border shadow-lg rounded-3xl flex items-center justify-between p-3 md:p-4 transition-all pointer-events-auto items-start">
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-full border border-border shadow-sm flex items-center justify-center shrink-0 overflow-hidden bg-background p-2 mt-1 md:mt-0">
                            <img
                                src="/logo.png"
                                alt="Parallax"
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <p className="text-sm md:text-lg text-foreground font-bold flex-1 pr-4 py-2 leading-snug">
                            {isListening
                                ? "Listening..."
                                : isProcessing || loading
                                  ? "Processing..."
                                  : isSpeaking
                                    ? "Speaking..."
                                    : systemMessage || "Assistant ready"}
                        </p>
                    </div>
                    <button
                        onClick={handleVoiceAction}
                        disabled={disableVoice}
                        className={`w-12 h-12 md:w-16 md:h-16 shrink-0 rounded-full flex items-center justify-center text-white shadow-md transition-all mt-1 md:mt-0 ${
                            isListening
                                ? "bg-primary animate-pulse scale-105"
                                : disableVoice
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-primary hover:scale-105 hover:bg-primary/90"
                        }`}
                        aria-label="Toggle Voice"
                    >
                        {isListening || isSpeaking ? <StopIcon /> : <MicIcon />}
                    </button>
                </div>
            ) : (
                <div className={innerClasses}>
                    {/* Top Controls: Mode Switch, Language & Voice Error */}
                    {!isHomeVoiceOnly && (
                        <div className="flex justify-between items-center text-sm mb-1 md:mb-2 border-b border-border pb-2 md:pb-4">
                            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-full border border-slate-200 shadow-inner">
                                <button
                                    onClick={() =>
                                        interactionMode !== "voice" &&
                                        toggleInteractionMode()
                                    }
                                    className={`px-2.5 sm:px-3 py-1 text-xs font-bold rounded-full transition-all ${interactionMode === "voice" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    Voice Mode
                                </button>
                                <button
                                    onClick={() =>
                                        interactionMode !== "text" &&
                                        toggleInteractionMode()
                                    }
                                    className={`px-2.5 sm:px-3 py-1 text-xs font-bold rounded-full transition-all ${interactionMode === "text" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    Text Mode
                                </button>
                            </div>

                            {inline && (
                                <button
                                    onClick={() => setIsMobileCollapsed(true)}
                                    className="lg:hidden text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition-colors"
                                >
                                    Minimize ▼
                                </button>
                            )}
                        </div>
                    )}

                    {voiceError && (
                        <div className="text-error font-medium text-center text-xs md:text-sm">
                            {voiceError}
                        </div>
                    )}

                    {!voiceError && interactionMode === "voice" && (
                        <div className="text-center mb-2 md:mb-4">
                            <span className="text-muted-foreground font-medium text-xs md:text-base">
                                {isPreparing
                                    ? "Warming up mic..."
                                    : isListening
                                      ? "Listening... (Speak now)"
                                      : isProcessing || loading
                                        ? "Processing..."
                                        : isSpeaking
                                          ? "Assistant Speaking..."
                                          : "Voice Paused. Tap mic to resume."}
                            </span>
                        </div>
                    )}

                    {/* System Message */}
                    <div className="flex items-start gap-2.5 md:gap-4">
                        <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0 p-1 md:p-1.5 overflow-hidden">
                            <img
                                src="/logo.png"
                                alt="Parallax Assistant"
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <div className="flex-1 bg-muted rounded-md md:rounded-lg p-3 md:p-5 rounded-tl-sm text-foreground text-sm md:text-lg font-medium shadow-sm max-h-[140px] md:max-h-none overflow-y-auto">
                            {loading || isProcessing ? (
                                <span className="animate-pulse">
                                    Processing...
                                </span>
                            ) : systemMessage ? (
                                systemMessage
                            ) : (
                                <span className="animate-pulse">
                                    Loading...
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Voice & Text Input */}
                    <div
                        className={`flex flex-col md:flex-row gap-2 md:gap-4 items-center justify-center ${interactionMode === "voice" ? "mt-2 md:mt-6" : "mt-1 md:mt-2"}`}
                    >
                        {/* Prominent Voice Button */}
                        <button
                            onClick={handleVoiceAction}
                            disabled={disableVoice}
                            className={`rounded-full flex items-center justify-center transition-all shadow-md shrink-0 
                  ${interactionMode === "voice" ? "w-16 h-16 sm:w-20 sm:h-20 md:w-28 md:h-28" : "w-14 h-14 md:w-20 md:h-20"}
                  ${
                      isPreparing
                          ? "bg-muted text-muted-foreground cursor-wait"
                          : isListening
                            ? "bg-primary text-primary-foreground animate-pulse scale-105 shadow-lg shadow-primary/20"
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
                            {isListening || isSpeaking ? (
                                <StopIcon />
                            ) : (
                                <MicIcon />
                            )}
                        </button>

                        {/* Text Input (Secondary) - Hidden in Voice Mode & Home Voice Only */}
                        {!isHomeVoiceOnly && interactionMode === "text" && (
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
                                    className="w-full bg-muted border-none rounded-md px-3 py-2.5 md:px-4 md:py-4 pr-16 outline-none focus:ring-2 focus:ring-primary text-sm md:text-lg"
                                />
                                <button
                                    type="submit"
                                    disabled={
                                        loading || !input.trim() || isListening
                                    }
                                    className="absolute right-1.5 top-1.5 bottom-1.5 bg-primary text-primary-foreground px-3 md:px-4 rounded-lg font-bold text-xs md:text-sm disabled:opacity-50 transition-colors hover:bg-primary/90"
                                >
                                    Send
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
