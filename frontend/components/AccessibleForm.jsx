"use client";

import React, { useEffect, useState, useRef } from "react";
import useFormStore from "../store/useFormStore.js";
import useNavigationStore from "../store/useNavigationStore.js";
import useLocalizationStore, { useTranslation } from "../store/useLocalizationStore.js";
import { Button } from "./ui/button.jsx";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "./ui/card.jsx";
import { Input } from "./ui/input.jsx";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select.jsx";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "./ui/dialog.jsx";
import { Progress } from "./ui/progress.jsx";
import { Label } from "./ui/label.jsx";
import { executeAction } from "../lib/actionDispatcher.js";
import { useRouter } from "next/navigation";
import { ACTIONS } from "../lib/navigation.js";
import {
    fetchChatAction,
    fetchChatActionStream,
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
    Eye,
    X,
    ExternalLink,
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
        isSubmitted,
    } = useFormStore();
    const { currentStepIndex, currentFieldId, stepHistory, setSystemMessage } =
        useNavigationStore();
    const router = useRouter();
    const { speak, queueSpeak, waitForSpeakQueue, pauseListening } = useVoice();
    const t = useTranslation();

    const [activeScannerTarget, setActiveScannerTarget] = useState(null); // 'autofill' or field object
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef(null);
    const [activeFileTarget, setActiveFileTarget] = useState(null);
    const [viewImageTarget, setViewImageTarget] = useState(null);

    useEffect(() => {
        const initForm = async () => {
            if (!formId) return;
            await loadSchema(formId);
            try {
                const submissionRes = await apiFetch(
                    `/api/submissions/${formId}`,
                );
                let loadedSubmission = false;
                if (submissionRes.ok) {
                    const existingSub = await submissionRes.json();
                    if (existingSub) {
                        useFormStore.setState((state) => ({
                            isSubmitted: true,
                            values: { ...state.values, ...existingSub.values },
                        }));
                        const currentSchema = useFormStore.getState().schema;
                        if (currentSchema) {
                            useNavigationStore
                                .getState()
                                .setStep(currentSchema.steps.length);
                        }
                        loadedSubmission = true;
                    }
                }

                if (!loadedSubmission) {
                    const draftData = await getDraft(formId);
                    if (draftData && draftData.draft) {
                        useFormStore.setState((state) => ({
                            values: {
                                ...state.values,
                                ...draftData.draft.values,
                            },
                        }));
                        if (draftData.draft.currentStepIndex !== undefined) {
                            useNavigationStore
                                .getState()
                                .setStep(draftData.draft.currentStepIndex);
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to load draft or submission", e);
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
        useNavigationStore.getState().setPage("form");
    }, []);

    useEffect(() => {
        const hasAssistantGreeting =
            stepHistory &&
            stepHistory[currentStepIndex] &&
            stepHistory[currentStepIndex].some((m) => m.role === "assistant");

        if (
            schema &&
            (schema.steps[currentStepIndex] ||
                currentStepIndex === schema.steps.length) &&
            !hasAssistantGreeting &&
            draftLoaded &&
            !fetchingRef.current
        ) {
            fetchingRef.current = true;
            setSystemMessage("", true);

            // Pause mic while fetching auto-greeting for the new step
            const currentMode = document.getElementById(
                "interaction-mode-indicator",
            )?.dataset?.mode;
            if (currentMode === "voice") {
                pauseListening(false);
            }

            const fetchGreeting = async () => {
                try {
                    const isReviewStep =
                        currentStepIndex === schema.steps.length;
                    const currentStep = isReviewStep
                        ? { title: "Review", id: "review_step", fields: [] }
                        : schema.steps[currentStepIndex];
                    const context = {
                        current_page: "form",
                        form_title: schema.title,
                        current_step: {
                            id: currentStep.id,
                            title: currentStep.title,
                            fields: currentStep.fields,
                        },
                        form_values: useFormStore.getState().values,
                        available_steps: [
                            ...schema.steps.map((s) => s.id),
                            "review_step",
                        ],
                    };
                    const formValues = useFormStore.getState().values;
                    const stepFields = currentStep.fields || [];
                    const missingRequired = stepFields.filter(f => f.required && !formValues[f.id]);
                    const isFullyFilled = stepFields.length > 0 && missingRequired.length === 0;
                    
                    const hasUploadedFiles = Object.values(formValues).some(v => typeof v === 'string' && (v.startsWith('http') || v.startsWith('data:')));
                    
                    const docType = (currentStep.autofill_document_type && !hasUploadedFiles) 
                        ? ` You can ask them to upload their ${currentStep.autofill_document_type} to autofill this step.` 
                        : "";
                    
                    let promptMsg = "";
                    if (useFormStore.getState().isSubmitted) {
                        promptMsg = `I just opened this application but I have already submitted it previously. Let me know that my form is already submitted, and ask if I would like to view my submitted details or delete my previous submission to restart.`;
                    } else if (isReviewStep) {
                        promptMsg = `I just entered the Review step. Please read out my details and ask me to confirm if everything is correct before I submit.`;
                    } else if (isFullyFilled) {
                        promptMsg = `I just entered the ${currentStep.title} step, but I have already filled out all the required information here. Please let me know that my details/documents are already provided and ask if I want to review/modify them, or proceed to the next step.`;
                    } else if (currentStepIndex === 0) {
                        promptMsg = `I just started the application. Please introduce the form and ask for my details.${!hasUploadedFiles ? ` Let me know I can tell you my details or scan/upload documents to autofill.` : ''}${docType}`;
                    } else {
                        promptMsg = `I just entered the ${currentStep.title} step. Please briefly announce this step and ask for my details.${!hasUploadedFiles ? ` Remind me I can tell you my details or scan/upload documents.` : ''}${docType}`;
                    }

                    const action = await fetchChatActionStream(
                        promptMsg,
                        context,
                        (sentence) => {
                            if (currentMode === "voice") {
                                queueSpeak(sentence);
                            }
                            useNavigationStore
                                .getState()
                                .appendSystemMessage(sentence);
                        },
                    );

                    if (action && action.message) {
                        setSystemMessage(action.message);
                        if (currentMode === "voice") {
                            waitForSpeakQueue().then(() => {
                                const modeAfter = document.getElementById(
                                    "interaction-mode-indicator",
                                )?.dataset?.mode;
                                if (modeAfter === "voice") {
                                    window.dispatchEvent(
                                        new Event("start-voice-turn"),
                                    );
                                }
                            });
                        }
                    } else if (currentMode === "voice") {
                        window.dispatchEvent(new Event("start-voice-turn"));
                    }
                } catch (err) {
                    console.error("Failed to fetch auto-greeting:", err);
                    if (currentMode === "voice") {
                        window.dispatchEvent(new Event("start-voice-turn"));
                    }
                } finally {
                    fetchingRef.current = false;
                }
            };
            fetchGreeting();
        }
    }, [
        currentStepIndex,
        schema,
        stepHistory,
        setSystemMessage,
        draftLoaded,
        speak,
        pauseListening,
    ]);

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
                setActiveScannerTarget(field || "autofill");
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
                setActiveFileTarget(field || "autofill");
            }
        };

        const handleSubmit = async () => {
            try {
                const res = await apiFetch(`/api/submissions/${formId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        values: useFormStore.getState().values,
                    }),
                });

                if (res.ok) {
                    setSystemMessage("Form successfully submitted.", true);
                    useFormStore.getState().resetForm();
                    useNavigationStore.getState().resetNavigation();

                    const currentMode = document.getElementById(
                        "interaction-mode-indicator",
                    )?.dataset?.mode;
                    if (currentMode === "voice") {
                        speak("Form successfully submitted.").then(() => {
                            router.push("/home");
                        });
                    } else {
                        router.push("/home");
                    }
                } else {
                    const data = await res.json();
                    setSystemMessage(
                        `Failed to submit form: ${data.error}`,
                        true,
                    );
                }
            } catch (err) {
                console.error("Submission error", err);
                setSystemMessage(
                    "Failed to submit form due to a network error.",
                    true,
                );
            }
        };

        const handleRestart = async () => {
            try {
                await apiFetch(`/api/submissions/${formId}`, {
                    method: "DELETE",
                });
            } catch (e) {
                console.error("Failed to delete form", e);
            }
        };

        window.addEventListener("trigger-scanner", handleTriggerScanner);
        window.addEventListener("trigger-file-picker", handleTriggerFilePicker);
        window.addEventListener("trigger-submit", handleSubmit);
        window.addEventListener("trigger-restart", handleRestart);

        return () => {
            window.removeEventListener("trigger-scanner", handleTriggerScanner);
            window.removeEventListener(
                "trigger-file-picker",
                handleTriggerFilePicker,
            );
            window.removeEventListener("trigger-submit", handleSubmit);
            window.removeEventListener("trigger-restart", handleRestart);
        };
    }, [schema, currentStepIndex, formId, setSystemMessage, router, speak]);

    const processFileToDataUrl = async (file) => {
        if (
            file.type === "application/pdf" ||
            file.name.toLowerCase().endsWith(".pdf")
        ) {
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
                throw new Error(
                    "Could not process PDF file. Please upload an image or scan with camera.",
                );
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
                        raw = raw.replace(
                            "data:image/jpg;",
                            "data:image/jpeg;",
                        );
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
                const msg =
                    "SYSTEM: Document upload processing failed. Explain that the document could not be read clearly, and politely ask them to try scanning again or tell the details directly. DO NOT tell them to skip the section.";
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
            const action = await fetchChatActionStream(
                msg,
                context,
                (sentence) => {
                    const currentMode = document.getElementById(
                        "interaction-mode-indicator",
                    )?.dataset?.mode;
                    if (currentMode === "voice") {
                        queueSpeak(sentence);
                    }
                    useNavigationStore.getState().appendSystemMessage(sentence);
                },
            );

            if (action && action.message) {
                setSystemMessage(action.message);
                const currentMode = document.getElementById(
                    "interaction-mode-indicator",
                )?.dataset?.mode;
                if (currentMode === "voice") {
                    waitForSpeakQueue().then(() => {
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
                    const msg = `SYSTEM: Document autofill failed. Reason: ${response.reason || "Image unreadable"}. Politely explain what went wrong and how they can fix it (e.g. better lighting, correct document). DO NOT tell them to skip the section.`;
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
                    const msg = `SYSTEM: Document verification failed for ${target.label}. Reason: ${verifyResult.reason}. Politely explain the specific issue and ask them to retry scanning/uploading. DO NOT tell them to skip the section.`;
                    await dispatchBackgroundSystemMessage(msg);
                }
            }
        } catch (err) {
            console.error("handleProcessDocument error:", err);
            const msg = `SYSTEM: Document processing encountered an error. Explain that the system had trouble processing the document image, and politely ask them to try scanning again. DO NOT tell them to skip the section.`;
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

    if (!schema || !draftLoaded) {
        return (
            <div className="w-full flex flex-col items-center justify-center min-h-[500px] text-center p-8 space-y-6">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <h2 className="text-2xl font-bold text-foreground">
                    Loading your application...
                </h2>
            </div>
        );
    }

    if (isSubmitted) {
        return (
            <div className="w-full flex flex-col items-center justify-center min-h-[500px] text-center p-8 space-y-6">
                <div className="w-24 h-24 bg-primary/10 border border-border rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-12 h-12 text-primary" />
                </div>
                <h2 className="text-4xl md:text-5xl font-extrabold text-foreground">
                    Application Submitted
                </h2>
                <p className="text-lg md:text-xl text-muted-foreground max-w-lg mx-auto font-medium">
                    You have already successfully submitted this application.
                    Your details have been recorded.
                </p>

                <Card className="w-full max-w-3xl mt-8 mb-8 text-left shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted border-b border-border px-8 py-5">
                        <CardTitle className="text-2xl font-bold text-foreground">
                            Submitted Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 divide-y divide-border">
                        {schema.steps.map((step) => (
                            <div
                                key={step.id}
                                className="py-6 first:pt-0 last:pb-0"
                            >
                                <h4 className="text-xl font-bold text-primary mb-4">
                                    {step.title}
                                </h4>
                                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                    {step.fields.map((field) => (
                                        <div
                                            key={field.id}
                                            className="flex flex-col"
                                        >
                                            <dt className="text-sm font-bold text-muted-foreground mb-1 uppercase tracking-wider">
                                                {field.label}
                                            </dt>
                                            <dd className="text-lg font-medium text-foreground">
                                                {field.type === "file" ? (
                                                    values[field.id] ? (
                                                        <a
                                                            href={
                                                                values[field.id]
                                                            }
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-primary hover:underline flex items-center gap-1 font-bold"
                                                        >
                                                            View Document{" "}
                                                            <ExternalLink className="w-4 h-4" />
                                                        </a>
                                                    ) : (
                                                        "Not uploaded"
                                                    )
                                                ) : (
                                                    values[field.id] ||
                                                    "Not provided"
                                                )}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>
                        ))}
                    </CardContent>
                </Card>
                <div className="flex flex-col sm:flex-row gap-4 pt-8 justify-center w-full">
                    <Button
                        size="lg"
                        onClick={() =>
                            executeAction(
                                {
                                    action: ACTIONS.NAVIGATE_PAGE,
                                    target: "home",
                                },
                                router,
                            )
                        }
                        className="h-16 px-10 text-xl font-bold flex-1 max-w-[250px]"
                    >
                        Back to Home
                    </Button>
                    <Button
                        size="lg"
                        variant="destructive"
                        onClick={() =>
                            executeAction(
                                { action: ACTIONS.RESTART_FORM },
                                router,
                            )
                        }
                        className="h-16 px-10 text-xl font-bold flex-1 max-w-[250px]"
                    >
                        Delete & Restart
                    </Button>
                </div>
            </div>
        );
    }

    const isReviewStep = currentStepIndex === schema.steps.length;
    const currentStep = isReviewStep
        ? { title: "Review & Submit", id: "review_step", fields: [] }
        : schema.steps[currentStepIndex];

    if (!currentStep) return null;

    const handleNext = () => {
        if (isReviewStep) {
            executeAction({ action: ACTIONS.SUBMIT }, router);
        } else {
            executeAction({ action: ACTIONS.NEXT }, router);
        }
    };
    const handlePrev = () =>
        executeAction({ action: ACTIONS.PREVIOUS }, router);

    return (
        <div className="w-full flex flex-col justify-between relative min-h-[500px]">
            {isProcessing && (
                <div className="absolute inset-0 z-40 bg-background/80 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center">
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
                <div className="mb-10 space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-4 py-1.5 rounded-lg">
                            Step{" "}
                            {Math.min(
                                currentStepIndex + 1,
                                schema.steps.length,
                            )}{" "}
                            of {schema.steps.length}
                        </span>
                        <span className="text-sm font-bold text-muted-foreground font-mono">
                            {Math.round(
                                (Math.min(
                                    currentStepIndex + 1,
                                    schema.steps.length,
                                ) /
                                    schema.steps.length) *
                                    100,
                            )}
                            % Complete
                        </span>
                    </div>

                    <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                        {currentStep.title}
                    </h2>

                    {/* Visual Progress Bar */}
                    <Progress
                        value={
                            (Math.min(
                                currentStepIndex + 1,
                                schema.steps.length,
                            ) /
                                schema.steps.length) *
                            100
                        }
                        className="h-3"
                    />
                </div>

                {/* Impairment-Friendly Big Button Autofill Bar */}
                {currentStep.fields.some((f) => f.type !== "file") && (
                    <div className="mb-10 p-6 rounded-md bg-secondary/10 border border-border">
                        <div className="flex items-center gap-3 mb-4">
                            <Sparkles className="w-6 h-6 text-secondary" />
                            <p className="text-lg md:text-xl font-extrabold text-foreground">
                                Autofill this step with a document:
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Button
                                type="button"
                                size="lg"
                                onClick={() =>
                                    setActiveScannerTarget("autofill")
                                }
                                className="h-16 md:h-[72px] px-6 text-xl bg-secondary text-secondary-foreground hover:bg-secondary/90 flex items-center justify-center gap-3"
                            >
                                <Camera className="w-7 h-7 shrink-0" />
                                <span>Scan Document</span>
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="lg"
                                onClick={() => {
                                    setActiveFileTarget("autofill");
                                    fileInputRef.current.click();
                                }}
                                className="h-16 md:h-[72px] px-6 text-xl border-border bg-card text-foreground flex items-center justify-center gap-3"
                            >
                                <Upload className="w-7 h-7 shrink-0" />
                                <span>Upload File</span>
                            </Button>
                        </div>
                    </div>
                )}

                <div className="space-y-6">
                    {isReviewStep ? (
                        <div className="flex flex-col gap-6">
                            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-2">
                                Review Your Application
                            </h2>
                            <p className="text-lg md:text-xl text-muted-foreground font-medium mb-6">
                                Please check all your details before submitting.
                            </p>
                            {schema.steps.map((step) => (
                                <Card key={step.id} className="shadow-sm">
                                    <CardHeader>
                                        <CardTitle className="text-2xl font-bold text-primary">
                                            {step.title}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {step.fields.map((field) => (
                                                <div
                                                    key={field.id}
                                                    className="flex flex-col"
                                                >
                                                    <span className="text-muted-foreground text-sm font-bold uppercase tracking-wider mb-1">
                                                        {field.label}
                                                    </span>
                                                    <span className="text-xl font-medium text-foreground">
                                                        {field.type ===
                                                            "file" &&
                                                        values[field.id]
                                                            ? "Document Uploaded"
                                                            : values[
                                                                  field.id
                                                              ] ||
                                                              "Not provided"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        currentStep.fields.map((field) => {
                            const isFocused = currentFieldId === field.id;

                            return (
                                <Card
                                    key={field.id}
                                    id={`field-container-${field.id}`}
                                    className={`flex flex-col gap-4 p-8 transition-all duration-300 ${
                                        isFocused
                                            ? "bg-primary/5 border-primary shadow-sm"
                                            : ""
                                    }`}
                                >
                                    <label
                                        htmlFor={field.id}
                                        className="text-xl font-bold text-foreground flex items-center gap-2"
                                    >
                                        {field.label}
                                        {field.required && (
                                            <span className="text-destructive">
                                                *
                                            </span>
                                        )}
                                    </label>

                                    {field.type === "select" ? (
                                        <Select
                                            value={values[field.id] || ""}
                                            onValueChange={(val) =>
                                                useFormStore
                                                    .getState()
                                                    .updateValue(
                                                        field.id,
                                                        val,
                                                        true,
                                                    )
                                            }
                                        >
                                            <SelectTrigger
                                                id={field.id}
                                                className={`h-14 text-lg bg-card ${isFocused ? "ring-2 ring-primary" : ""}`}
                                            >
                                                <SelectValue placeholder="Select an option..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {field.options?.map((opt) => (
                                                    <SelectItem
                                                        key={opt}
                                                        value={opt}
                                                        className="text-lg"
                                                    >
                                                        {opt}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : field.type === "file" ? (
                                        <div className="flex flex-col md:flex-row gap-4">
                                            <Button
                                                size="lg"
                                                onClick={() =>
                                                    setActiveScannerTarget(
                                                        field,
                                                    )
                                                }
                                                className={`h-14 flex-1 text-lg font-bold transition-all flex items-center justify-center gap-2 ${values[field.id] ? "bg-secondary hover:bg-secondary/90 text-secondary-foreground" : "bg-primary hover:bg-primary/90 text-primary-foreground"}`}
                                            >
                                                {values[field.id] ? (
                                                    <>
                                                        <CheckCircle className="w-6 h-6" />{" "}
                                                        Verified ({t("rescan")})
                                                    </>
                                                ) : (
                                                    <>
                                                        <Camera className="w-6 h-6" />{" "}
                                                        Scan Document
                                                    </>
                                                )}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="lg"
                                                onClick={() => {
                                                    setActiveFileTarget(field);
                                                    fileInputRef.current.click();
                                                }}
                                                className={`h-14 flex-1 text-lg font-bold bg-card transition-all flex items-center justify-center gap-2 border ${values[field.id] ? "border-secondary text-secondary" : "border-border text-foreground"}`}
                                            >
                                                {values[field.id] ? (
                                                    <>
                                                        <CheckCircle className="w-6 h-6" />{" "}
                                                        Verified (
                                                        {t("reupload")})
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload className="w-6 h-6" />{" "}
                                                        Upload File
                                                    </>
                                                )}
                                            </Button>
                                            {values[field.id] && (
                                                <Button
                                                    variant="outline"
                                                    size="lg"
                                                    onClick={() =>
                                                        setViewImageTarget(
                                                            values[field.id],
                                                        )
                                                    }
                                                    className="h-14 flex-1 text-lg font-bold transition-all flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-foreground border-border"
                                                >
                                                    <Eye className="w-6 h-6" />{" "}
                                                    {t("view_document")}
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        <Input
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
                                            className={`h-14 text-lg bg-card ${isFocused ? "ring-2 ring-primary" : ""}`}
                                        />
                                    )}

                                    {field.description && (
                                        <p className="text-lg text-muted-foreground font-medium mt-1">
                                            {field.description}
                                        </p>
                                    )}
                                </Card>
                            );
                        })
                    )}
                </div>
            </div>

            <div className="mt-16 flex gap-4">
                <Button
                    variant="outline"
                    size="lg"
                    onClick={handlePrev}
                    disabled={currentStepIndex === 0}
                    className="h-14 md:h-16 px-8 text-lg md:text-xl font-bold bg-card border-border flex-1 max-w-[200px]"
                >
                    {t("go_back_form")}
                </Button>
                <Button
                    size="lg"
                    onClick={handleNext}
                    disabled={isReviewStep && isSubmitted}
                    className={`h-14 md:h-16 px-8 text-lg md:text-xl font-bold flex-1 ${isReviewStep && isSubmitted ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground" : "bg-primary hover:bg-primary/90"}`}
                >
                    {isReviewStep
                        ? isSubmitted
                            ? "Already Submitted"
                            : t("submit_application")
                        : t("next")}
                </Button>
            </div>

            {activeScannerTarget && (
                <DocumentScanner
                    onCancel={() => setActiveScannerTarget(null)}
                    onConfirm={handleScannerConfirm}
                />
            )}

            <Dialog
                open={!!activeFileTarget}
                onOpenChange={(open) => !open && setActiveFileTarget(null)}
            >
                <DialogContent className="sm:max-w-md text-center p-8 md:p-12">
                    <div className="flex flex-col items-center space-y-6">
                        <div className="w-24 h-24 bg-primary/10 border border-border rounded-full flex items-center justify-center mx-auto mb-2">
                            <Upload className="w-12 h-12 text-primary" />
                        </div>
                        <DialogHeader>
                            <DialogTitle className="text-3xl md:text-4xl font-extrabold text-foreground text-center">
                                Upload Document
                            </DialogTitle>
                            <DialogDescription className="text-lg md:text-xl font-medium text-center">
                                Please select the document file to upload for{" "}
                                {activeFileTarget === "autofill"
                                    ? "auto-filling this step"
                                    : activeFileTarget?.label || "this field"}
                                .
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-4 mt-8 w-full">
                            <Button
                                size="lg"
                                onClick={() => {
                                    if (fileInputRef.current)
                                        fileInputRef.current.click();
                                }}
                                className="h-16 text-xl font-bold transition-all w-full"
                            >
                                Choose File
                            </Button>
                            <Button
                                variant="outline"
                                size="lg"
                                onClick={() => setActiveFileTarget(null)}
                                className="h-16 text-lg border-border font-bold transition-all w-full"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!viewImageTarget}
                onOpenChange={(open) => !open && setViewImageTarget(null)}
            >
                <DialogContent className="max-w-4xl p-6">
                    <DialogHeader className="flex flex-row justify-between items-center mb-4 space-y-0">
                        <DialogTitle className="text-2xl font-bold">
                            Document Preview
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto rounded-lg border border-border flex items-center justify-center bg-muted min-h-[50vh]">
                        {viewImageTarget && (
                            <img
                                src={viewImageTarget}
                                alt="Document Preview"
                                className="max-w-full max-h-[75vh] object-contain"
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
