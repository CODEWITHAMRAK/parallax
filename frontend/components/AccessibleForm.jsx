"use client";

import React, { useEffect, useState, useRef } from "react";
import useFormStore from "../store/useFormStore.js";
import useNavigationStore from "../store/useNavigationStore.js";
import { Button } from "./ui/button.jsx";
import { executeAction } from "../lib/actionDispatcher.js";
import { useRouter } from "next/navigation";
import { ACTIONS } from "../lib/navigation.js";
import {
    fetchChatAction,
    getDraft,
    saveDraft,
    autofillFromDocumentApi,
} from "../lib/apiService.js";
import { useVoice } from "../hooks/useVoice.js";
import DocumentScanner from "./scanner/DocumentScanner.jsx";
import {
    Camera,
    Upload,
    CheckCircle,
    XCircle,
    Loader2,
    Sparkles,
} from "lucide-react";
import { apiFetch } from "../lib/api.js";

export default function AccessibleForm({ formId }) {
    const {
        schema,
        values,
        completed,
        loadSchema,
        loadingSchema,
        error,
        draftLoaded,
    } = useFormStore();
    const { currentStepIndex, currentFieldId, stepHistory, setSystemMessage } =
        useNavigationStore();
    const router = useRouter();
    const { speak } = useVoice();

    const [activeScannerTarget, setActiveScannerTarget] = useState(null); // 'autofill' or field object
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef(null);
    const [activeFileTarget, setActiveFileTarget] = useState(null);

    useEffect(() => {
        const initForm = async () => {
            if (!formId) return;
            await loadSchema(formId);
            try {
                const draftData = await getDraft(formId);
                if (draftData && draftData.draft) {
                    useFormStore.setState((state) => ({
                        values: { ...state.values, ...draftData.draft.values },
                    }));
                    if (draftData.draft.currentStepIndex !== undefined) {
                        useNavigationStore
                            .getState()
                            .setStep(draftData.draft.currentStepIndex);
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

    useEffect(() => {
        if (schema && formId) {
            const timer = setTimeout(() => {
                saveDraft(formId, values, currentStepIndex).catch((e) =>
                    console.error("Auto-save failed", e),
                );
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [values, currentStepIndex, schema, formId]);

    const fetchingRef = useRef(false);

    useEffect(() => {
        useNavigationStore.getState().setPage('form');
    }, []);

    useEffect(() => {
        const hasAssistantGreeting = stepHistory && stepHistory[currentStepIndex] && stepHistory[currentStepIndex].some(m => m.role === 'assistant');

        if (
            schema &&
            schema.steps[currentStepIndex] &&
            !hasAssistantGreeting &&
            draftLoaded &&
            !fetchingRef.current
        ) {
            fetchingRef.current = true;
            setSystemMessage("", true);
            const fetchGreeting = async () => {
                try {
                    const currentStep = schema.steps[currentStepIndex];
                    const context = {
                        current_page: "form",
                        form_title: schema.title,
                        current_step: {
                            id: currentStep.id,
                            title: currentStep.title,
                            fields: currentStep.fields,
                        },
                        form_values: useFormStore.getState().values,
                        available_steps: schema.steps.map((s) => s.id),
                    };
                    const promptMsg = currentStepIndex === 0
                        ? "I just started the application. Please introduce the scholarship form and let me know I can tell you my details or scan/upload documents to autofill."
                        : `I just entered the ${currentStep.title} step. Please briefly announce this step and remind me I can tell you my details or scan/upload documents.`;

                    const action = await fetchChatAction(
                        promptMsg,
                        context,
                    );
                    if (action.message) {
                        setSystemMessage(action.message);
                        const currentMode = document.getElementById(
                            "interaction-mode-indicator",
                        )?.dataset?.mode;
                        if (currentMode === "voice") {
                            speak(action.message).then(() => {
                                setTimeout(
                                    () =>
                                        window.dispatchEvent(
                                            new Event("start-voice-turn"),
                                        ),
                                    200,
                                );
                            });
                        }
                    }
                } catch (e) {
                    console.error("Failed to auto-fetch greeting", e);
                } finally {
                    fetchingRef.current = false;
                }
            };
            fetchGreeting();
        }
    }, [currentStepIndex, schema, stepHistory, setSystemMessage, draftLoaded, speak]);

    // Handle custom events for scanning and picking files
    useEffect(() => {
        const handleTriggerScanner = (e) => {
            const target = e.detail.target;
            if (target === "autofill") {
                setActiveScannerTarget("autofill");
            } else {
                const field = schema?.steps[currentStepIndex]?.fields.find(
                    (f) => f.id === target,
                );
                if (field) setActiveScannerTarget(field);
            }
        };

        const handleTriggerFilePicker = (e) => {
            const target = e.detail.target;
            if (target === "autofill") {
                setActiveFileTarget("autofill");
            } else {
                const field = schema?.steps[currentStepIndex]?.fields.find(
                    (f) => f.id === target,
                );
                if (field) setActiveFileTarget(field);
            }
            if (fileInputRef.current) fileInputRef.current.click();
        };

        window.addEventListener("trigger-scanner", handleTriggerScanner);
        window.addEventListener("trigger-file-picker", handleTriggerFilePicker);

        return () => {
            window.removeEventListener("trigger-scanner", handleTriggerScanner);
            window.removeEventListener(
                "trigger-file-picker",
                handleTriggerFilePicker,
            );
        };
    }, [schema, currentStepIndex]);

    const processFileToDataUrl = async (file) => {
        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
            try {
                const pdfjsLib = await import("pdfjs-dist");
                pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                const pdf = await loadingTask.promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({ canvasContext: context, viewport }).promise;
                return canvas.toDataURL("image/jpeg", 0.92);
            } catch (err) {
                console.error("PDF rendering error:", err);
                throw new Error("Could not process PDF file. Please upload an image or scan with camera.");
            }
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL("image/jpeg", 0.9));
                };
                img.onerror = () => {
                    let raw = e.target.result;
                    if (raw && raw.startsWith("data:image/jpg;")) {
                        raw = raw.replace("data:image/jpg;", "data:image/jpeg;");
                    }
                    resolve(raw);
                };
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleFileChange = async (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const target = activeFileTarget;
            setActiveFileTarget(null);

            try {
                const dataUrl = await processFileToDataUrl(file);
                await handleProcessDocument(dataUrl, target);
            } catch (err) {
                console.error(err);
                const msg = "SYSTEM: Document upload processing failed. Politely tell the user that the document could not be read, and ask them to tell the first missing required field or try scanning again.";
                await dispatchBackgroundSystemMessage(msg);
            }
        }
    };

    const dispatchBackgroundSystemMessage = async (msg) => {
        try {
            const currentStep = schema.steps[currentStepIndex];
            const context = {
                current_page: "form",
                form_title: schema.title,
                current_step: {
                    id: currentStep.id,
                    title: currentStep.title,
                    fields: currentStep.fields,
                },
                form_values: useFormStore.getState().values,
                available_steps: schema.steps.map((s) => s.id),
            };
            const action = await fetchChatAction(msg, context);
            if (action.message) {
                setSystemMessage(action.message);
                const currentMode = document.getElementById(
                    "interaction-mode-indicator",
                )?.dataset?.mode;
                if (currentMode === "voice") {
                    speak(action.message).then(() => {
                        setTimeout(
                            () =>
                                window.dispatchEvent(
                                    new Event("start-voice-turn"),
                                ),
                            200,
                        );
                    });
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleProcessDocument = async (dataUrl, target) => {
        setIsProcessing(true);
        setSystemMessage("Processing document...", true);

        try {
            if (target === "autofill") {
                const currentStep = schema.steps[currentStepIndex];
                const response = await autofillFromDocumentApi(
                    dataUrl,
                    currentStep.fields,
                );

                if (
                    response.success &&
                    Object.keys(response.extractedData).length > 0
                ) {
                    Object.entries(response.extractedData).forEach(
                        ([key, val]) => {
                            if (val)
                                useFormStore
                                    .getState()
                                    .updateValue(key, val, true);
                        },
                    );
                    const msg = `SYSTEM: Document autofill complete. Extracted: ${JSON.stringify(response.extractedData)}. Say the fields you extracted and ask for any remaining required fields.`;
                    await dispatchBackgroundSystemMessage(msg);
                } else {
                    const msg = `SYSTEM: Document autofill failed. Reason: ${response.reason || "Image unreadable"}. Politely tell the user to try again or tell the details directly.`;
                    await dispatchBackgroundSystemMessage(msg);
                }
            } else {
                // Validation flow
                const verifyRes = await apiFetch("/api/upload/verify", {
                    method: "POST",
                    body: JSON.stringify({
                        fileDataUrl: dataUrl,
                        expectedType: target.id,
                    }),
                });
                const verifyResult = await verifyRes.json();

                if (verifyResult.documentMatch && verifyResult.readable) {
                    const uploadRes = await apiFetch("/api/upload", {
                        method: "POST",
                        body: JSON.stringify({ fileDataUrl: dataUrl }),
                    });
                    if (!uploadRes.ok)
                        throw new Error("Upload to cloud failed.");
                    const uploadData = await uploadRes.json();
                    useFormStore
                        .getState()
                        .updateValue(target.id, uploadData.url, true);

                    const msg = `SYSTEM: Document verified and uploaded successfully for ${target.label}. Move to next step or ask for next missing field.`;
                    await dispatchBackgroundSystemMessage(msg);
                } else {
                    const msg = `SYSTEM: Document verification failed for ${target.label}. Reason: ${verifyResult.reason}. Ask user if they want to retry scanning/uploading or skip.`;
                    await dispatchBackgroundSystemMessage(msg);
                }
            }
        } catch (err) {
            console.error("handleProcessDocument error:", err);
            const msg = `SYSTEM: Document processing encountered an error. Politely tell the user that the document image could not be processed, and ask them to tell the first missing required field or try scanning again.`;
            await dispatchBackgroundSystemMessage(msg);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleScannerConfirm = async (dataUrl) => {
        const target = activeScannerTarget;
        setActiveScannerTarget(null);
        await handleProcessDocument(dataUrl, target);
    };

    if (loadingSchema) {
        return (
            <div className="p-8 text-xl animate-pulse text-primary flex items-center gap-2">
                <Loader2 className="animate-spin" /> Loading form details...
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-xl text-destructive flex items-center gap-2">
                <XCircle /> Error: {error}
            </div>
        );
    }

    if (!schema) return null;

    const currentStep = schema.steps[currentStepIndex];
    if (!currentStep) return null;

    const handleNext = () => executeAction({ action: ACTIONS.NEXT }, router);
    const handlePrev = () =>
        executeAction({ action: ACTIONS.PREVIOUS }, router);

    return (
        <div className="w-full flex flex-col justify-between relative min-h-[500px]">
            {isProcessing && (
                <div className="absolute inset-0 z-40 bg-background/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center">
                    <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
                    <p className="text-2xl font-bold text-primary animate-pulse">
                        Processing Document...
                    </p>
                </div>
            )}

            <input
                type="file"
                ref={fileInputRef}
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
            />

            <div>
                {/* Step Header & Progress Bar */}
                <div className="mb-8 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs md:text-sm font-bold uppercase tracking-wider text-[#003441] bg-[#003441]/10 px-3.5 py-1 rounded-full">
                            Step {currentStepIndex + 1} of {schema.steps.length}
                        </span>
                        <span className="text-xs md:text-sm font-bold text-slate-500">
                            {Math.round(((currentStepIndex + 1) / schema.steps.length) * 100)}% Complete
                        </span>
                    </div>

                    <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary tracking-tight">
                        {currentStep.title}
                    </h2>

                    {/* Visual Progress Bar */}
                    <div 
                        className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden" 
                        role="progressbar" 
                        aria-valuenow={currentStepIndex + 1} 
                        aria-valuemin={1} 
                        aria-valuemax={schema.steps.length}
                        aria-label={`Step ${currentStepIndex + 1} of ${schema.steps.length}`}
                    >
                        <div 
                            className="bg-[#003441] h-full rounded-full transition-all duration-500 ease-out shadow-sm"
                            style={{ width: `${((currentStepIndex + 1) / schema.steps.length) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Impairment-Friendly Big Button Autofill Bar */}
                {currentStep.fields.some(f => f.type !== 'file') && (
                    <div className="mb-8 p-4 md:p-5 rounded-2xl bg-[#003441]/5 border-2 border-[#003441]/20">
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-5 h-5 text-[#003441]" />
                            <p className="text-base md:text-lg font-bold text-[#003441]">
                                Autofill this step with a document:
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                            <Button
                                type="button"
                                onClick={() => setActiveScannerTarget("autofill")}
                                className="h-16 md:h-18 px-6 rounded-2xl bg-[#003441] hover:bg-[#002833] text-white text-lg md:text-xl font-bold flex items-center justify-center gap-3 shadow-md hover:scale-[1.01] active:scale-[0.98] transition-all"
                            >
                                <Camera className="w-6 h-6 md:w-7 md:h-7 shrink-0" />
                                <span>Scan Document</span>
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setActiveFileTarget("autofill");
                                    fileInputRef.current.click();
                                }}
                                className="h-16 md:h-18 px-6 rounded-2xl bg-white hover:bg-slate-100 border-2 border-slate-300 text-[#003441] text-lg md:text-xl font-bold flex items-center justify-center gap-3 shadow-sm hover:scale-[1.01] active:scale-[0.98] transition-all"
                            >
                                <Upload className="w-6 h-6 md:w-7 md:h-7 shrink-0" />
                                <span>Upload PDF / Photo</span>
                            </Button>
                        </div>
                    </div>
                )}

                <div className="space-y-6">
                    {currentStep.fields.map((field) => {
                        const isFocused = currentFieldId === field.id;
                        return (
                            <div key={field.id} className="flex flex-col gap-2">
                                <label
                                    htmlFor={field.id}
                                    className="font-heading text-xl font-semibold text-foreground"
                                >
                                    {field.label}{" "}
                                    {field.required && (
                                        <span className="text-destructive">
                                            *
                                        </span>
                                    )}
                                </label>

                                {field.type === "select" ? (
                                    <select
                                        id={field.id}
                                        value={values[field.id] || ""}
                                        onChange={(e) =>
                                            useFormStore
                                                .getState()
                                                .updateValue(
                                                    field.id,
                                                    e.target.value,
                                                    true,
                                                )
                                        }
                                        className={`h-[64px] rounded-lg px-4 bg-input text-xl text-foreground border-b-2 outline-none transition-all ${
                                            isFocused
                                                ? "border-primary border-2"
                                                : "border-border"
                                        }`}
                                    >
                                        <option value="" disabled>
                                            Select an option...
                                        </option>
                                        {field.options?.map((opt) => (
                                            <option key={opt} value={opt}>
                                                {opt}
                                            </option>
                                        ))}
                                    </select>
                                ) : field.type === "file" ? (
                                    <div className="flex flex-col md:flex-row gap-4">
                                        <Button
                                            onClick={() =>
                                                setActiveScannerTarget(field)
                                            }
                                            className={`h-[64px] flex-1 text-xl font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${values[field.id] ? "bg-green-600 hover:bg-green-700 text-white" : "bg-primary hover:bg-primary/90 text-primary-foreground"}`}
                                        >
                                            {values[field.id] ? (
                                                <>
                                                    <CheckCircle /> Verified
                                                    (Rescan)
                                                </>
                                            ) : (
                                                <>
                                                    <Camera /> Scan Document
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setActiveFileTarget(field);
                                                fileInputRef.current.click();
                                            }}
                                            className={`h-[64px] flex-1 text-xl font-bold rounded-lg transition-all flex items-center justify-center gap-2 border-2 ${values[field.id] ? "border-green-600 text-green-600" : "border-primary text-primary"}`}
                                        >
                                            {values[field.id] ? (
                                                <>
                                                    <CheckCircle /> Verified
                                                    (Re-upload)
                                                </>
                                            ) : (
                                                <>
                                                    <Upload /> Upload File
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                ) : (
                                    <input
                                        id={field.id}
                                        type={field.type}
                                        value={values[field.id] || ""}
                                        onChange={(e) =>
                                            useFormStore
                                                .getState()
                                                .updateValue(
                                                    field.id,
                                                    e.target.value,
                                                    true,
                                                )
                                        }
                                        className={`h-[64px] rounded-lg px-4 bg-input text-xl text-foreground border-b-2 outline-none transition-all ${
                                            isFocused
                                                ? "border-primary border-2"
                                                : "border-border"
                                        }`}
                                    />
                                )}

                                {field.description && (
                                    <p className="text-lg text-muted-foreground">
                                        {field.description}
                                    </p>
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
                    {currentStepIndex === schema.steps.length - 1
                        ? "Review & Submit"
                        : "Next Step"}
                </Button>
            </div>

            {activeScannerTarget && (
                <DocumentScanner
                    onCancel={() => setActiveScannerTarget(null)}
                    onConfirm={handleScannerConfirm}
                />
            )}
        </div>
    );
}
