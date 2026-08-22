"use client";

import React, { useEffect, useState, useRef } from "react";
import { useCamera } from "../../hooks/useCamera";
import { SCANNER_STATES } from "../../lib/scanner/ScannerState";
import { DocumentDetector } from "../../lib/scanner/DocumentDetector";
import { GuidanceEngine } from "../../lib/scanner/GuidanceEngine";
import { ImageProcessor } from "../../lib/scanner/ImageProcessor";
import { OCRService } from "../../lib/scanner/OCRService";
import { DocumentVerifier } from "../../lib/scanner/DocumentVerifier";
import { Button } from "../ui/button";
import Script from "next/script";
import { useVoice } from "../../hooks/useVoice";

export default function DocumentScanner({ expectedDocumentType = "income_certificate", onCancel, onConfirm }) {
  const { videoRef, startCamera, stopCamera, error } = useCamera();
  const [scannerState, setScannerState] = useState(SCANNER_STATES.INITIALIZING_CAMERA);
  const [cvLoaded, setCvLoaded] = useState(false);
  const [guidanceText, setGuidanceText] = useState("Let's scan your document. Please wait while we initialize the camera.");
  
  const { speak, playSystemAudio, playScannerAudio } = useVoice();
  const [verificationResult, setVerificationResult] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  
  const detectorRef = useRef(null);
  const guidanceRef = useRef(new GuidanceEngine());
  const processorRef = useRef(null);
  const ocrRef = useRef(new OCRService());
  const verifierRef = useRef(new DocumentVerifier());
  const requestRef = useRef();
  
  const hasTriggeredCapture = useRef(false);
  const lastProcessTime = useRef(0);
  const targetFPS = 20;
  const fpsInterval = 1000 / targetFPS;
  // Critical: use a ref to track state inside the rAF loop to avoid stale closures
  const scannerStateRef = useRef(SCANNER_STATES.INITIALIZING_CAMERA);

  // 1. Camera Lifecycle
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // 2. OpenCV & OCR Lifecycle: when OpenCV finishes loading, start the scanner loop
  useEffect(() => {
    if (cvLoaded) {
      scannerStateRef.current = SCANNER_STATES.SEARCHING;
      setScannerState(SCANNER_STATES.SEARCHING);
      setGuidanceText("Find the document. Point your camera at it.");
      ocrRef.current.init("eng");
      // Restart the rAF loop now that the detector is ready
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      requestRef.current = requestAnimationFrame(processFrame);
    }

    return () => {
      // Only clean up OCR/detector, NOT the rAF loop (that's the mount effect's job)
      if (ocrRef.current) ocrRef.current.terminate();
      if (detectorRef.current) detectorRef.current.cleanup();
    };
  }, [cvLoaded]);

  const handleCvLoaded = () => {
    console.log("OpenCV script loaded, waiting for WASM runtime...");
    
    const checkCvReady = setInterval(() => {
      if (window.cv && window.cv.Mat) {
        try {
          // Test if Mat is a constructor yet (WASM loaded)
          const m = new window.cv.Mat();
          m.delete();
          
          clearInterval(checkCvReady);
          console.log("OpenCV WASM runtime initialized.");
          console.count("DocumentDetector CREATED");
          detectorRef.current = new DocumentDetector(window.cv);
          processorRef.current = new ImageProcessor(window.cv);
          setCvLoaded(true);
        } catch (e) {
          // Still loading
        }
      }
    }, 100);
  };

  const speakInstruction = (text) => {
    if (text === "Hold still.") {
        if ("vibrate" in navigator) navigator.vibrate(200);
    }
    playScannerAudio(text);
  };

  const ACTIVE_STATES = new Set([SCANNER_STATES.SEARCHING, SCANNER_STATES.DOCUMENT_DETECTED]);
  const DONE_STATES = new Set([SCANNER_STATES.CAPTURING, SCANNER_STATES.PROCESSING, SCANNER_STATES.VERIFYING, SCANNER_STATES.RESULT]);

  const processFrame = () => {
    // Read from ref, NOT from state — state is stale inside rAF closures
    const currentState = scannerStateRef.current;

    // Gate 1: essential refs not ready yet
    if (!videoRef.current || !canvasRef.current || !detectorRef.current) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Gate 2: camera not streaming yet
    if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Gate 3: OpenCV not initialised yet
    if (currentState === SCANNER_STATES.INITIALIZING_CAMERA) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Gate 4: capture already triggered — stop loop
    if (DONE_STATES.has(currentState)) {
      return;
    }

    const now = performance.now();
    const elapsed = now - lastProcessTime.current;
    
    if (elapsed < fpsInterval) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }
    
    lastProcessTime.current = now;

    const video = videoRef.current;
    const rect = video.getBoundingClientRect();
    const dw = Math.round(rect.width);
    const dh = Math.round(rect.height);

    let geometry = null;
    try {
      // detect() processes the FULL uncropped video frame
      geometry = detectorRef.current.detect(video, canvasRef.current);
    } catch(e) {
      console.error('[Scanner] detect() threw:', e);
    }

    drawOverlay(geometry);

    // Pass viewport info so GuidanceEngine can map process-space → visible crop
    const viewport = {
      displayWidth:  dw,
      displayHeight: dh,
      videoWidth:    video.videoWidth,
      videoHeight:   video.videoHeight,
    };
    const guidance = guidanceRef.current.process(geometry, speakInstruction, viewport);
    
    if (guidance.currentInstruction) {
      setGuidanceText(guidance.currentInstruction);
    }

    if (geometry && currentState === SCANNER_STATES.SEARCHING) {
      scannerStateRef.current = SCANNER_STATES.DOCUMENT_DETECTED;
      setScannerState(SCANNER_STATES.DOCUMENT_DETECTED);
    } else if (!geometry && currentState === SCANNER_STATES.DOCUMENT_DETECTED) {
      scannerStateRef.current = SCANNER_STATES.SEARCHING;
      setScannerState(SCANNER_STATES.SEARCHING);
    }

    if (guidance.isStable && !DONE_STATES.has(currentState) && !hasTriggeredCapture.current) {
      hasTriggeredCapture.current = true;
      scannerStateRef.current = SCANNER_STATES.CAPTURING;
      setScannerState(SCANNER_STATES.CAPTURING);
      setGuidanceText("Document captured. Processing...");
      speakInstruction("Document captured.");
      handleCapture(geometry);
    } else {
      requestRef.current = requestAnimationFrame(processFrame);
    }
  };

  // Start the rAF loop once. The loop itself reads scannerStateRef to know what to do.
  useEffect(() => {
    requestRef.current = requestAnimationFrame(processFrame);
    return () => cancelAnimationFrame(requestRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount only

  const drawOverlay = (geometry) => {
    const canvas = overlayCanvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;

    // Read the display size from the video element's bounding rect
    // (not .clientWidth which can be stale before layout finishes)
    const rect   = video.getBoundingClientRect();
    // Round to integers — getBoundingClientRect() returns subpixel decimals
    // that vary frame-to-frame, causing canvas resets (= flicker) every frame.
    const dw = Math.round(rect.width);
    const dh = Math.round(rect.height);

    // Only resize the canvas when the display size actually changed —
    // assigning canvas.width/height clears the canvas AND resets all context state.
    if (canvas.width !== dw || canvas.height !== dh) {
      canvas.width  = dw;
      canvas.height = dh;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, dw, dh);

    if (!geometry) return;

    // ── Map from OpenCV processWidth × processHeight → display rect ──────────
    // The <video> uses object-fit:cover, which means the video is scaled to
    // fill the container keeping aspect ratio, potentially cropping.
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    const videoRatio     = vw / vh;
    const containerRatio = dw / dh;

    let scaledW, scaledH, offX, offY;

    if (containerRatio > videoRatio) {
      // Container is wider than video → letterbox on top/bottom
      scaledW = dw;
      scaledH = dw / videoRatio;
      offX = 0;
      offY = (dh - scaledH) / 2;
    } else {
      // Container is taller than video → pillarbox on left/right
      scaledH = dh;
      scaledW = dh * videoRatio;
      offX = (dw - scaledW) / 2;
      offY = 0;
    }

    const sx = scaledW / geometry.processWidth;
    const sy = scaledH / geometry.processHeight;

    const corners = geometry.corners;

    // ── Draw corner-marker style outline ─────────────────────────────────────
    // Full quad fill (subtle)
    ctx.beginPath();
    ctx.moveTo(offX + corners[0].x * sx, offY + corners[0].y * sy);
    for (let i = 1; i < 4; i++) {
      ctx.lineTo(offX + corners[i].x * sx, offY + corners[i].y * sy);
    }
    ctx.closePath();
    ctx.fillStyle   = 'rgba(0, 229, 255, 0.08)';
    ctx.fill();

    // Thick stroke
    ctx.beginPath();
    ctx.moveTo(offX + corners[0].x * sx, offY + corners[0].y * sy);
    for (let i = 1; i < 4; i++) {
      ctx.lineTo(offX + corners[i].x * sx, offY + corners[i].y * sy);
    }
    ctx.closePath();
    ctx.lineWidth   = 3;
    ctx.strokeStyle = '#00e5ff';
    ctx.stroke();

    // Corner accents — bold teal L-shapes at each corner
    const cornerLen = 24;
    ctx.lineWidth   = 6;
    ctx.strokeStyle = '#00e5ff';
    ctx.lineCap     = 'round';

    for (let i = 0; i < 4; i++) {
      const prev = corners[(i + 3) % 4];
      const cur  = corners[i];
      const next = corners[(i + 1) % 4];

      const cx = offX + cur.x * sx;
      const cy = offY + cur.y * sy;

      // Directions toward prev and next corners
      const toPrevX = offX + prev.x * sx - cx;
      const toPrevY = offY + prev.y * sy - cy;
      const toNextX = offX + next.x * sx - cx;
      const toNextY = offY + next.y * sy - cy;

      const lenPrev = Math.hypot(toPrevX, toPrevY) || 1;
      const lenNext = Math.hypot(toNextX, toNextY) || 1;

      ctx.beginPath();
      ctx.moveTo(cx + (toPrevX / lenPrev) * cornerLen, cy + (toPrevY / lenPrev) * cornerLen);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + (toNextX / lenNext) * cornerLen, cy + (toNextY / lenNext) * cornerLen);
      ctx.stroke();
    }
  };



  const handleCapture = async (geometry) => {
    setScannerState(SCANNER_STATES.PROCESSING);
    
    // 1. Perspective Transform & Quality Check
    const processed = processorRef.current.process(videoRef.current, geometry);
    if (!processed) {
      handleRetry("Failed to process image.");
      return;
    }
    
    setCapturedImage(processed.dataUrl);
    setScannerState(SCANNER_STATES.VERIFYING);
    setGuidanceText("Verifying document...");
    speakInstruction("Verifying document readability...");

    try {
      // 2. OCR
      const ocrData = await ocrRef.current.recognize(processed.dataUrl);
      
      // 3. Verification
      const result = verifierRef.current.verify(ocrData, processed.quality, expectedDocumentType);
      setVerificationResult(result);
      setScannerState(SCANNER_STATES.RESULT);

      if (result.documentMatch && result.readable) {
        speakInstruction("This looks good. Would you like to use this document?");
      } else {
        speakInstruction(result.reason || "Please try again.");
      }

    } catch (err) {
      console.error(err);
      handleRetry("Verification failed.");
    }
  };

  const handleRetry = (msg) => {
    if (msg) speakInstruction(msg);
    hasTriggeredCapture.current = false;
    // Re-instantiate to pick up latest class regardless of hot-reload state
    guidanceRef.current = new GuidanceEngine();
    setCapturedImage(null);
    setVerificationResult(null);
    // CRITICAL: update the ref first, then state, then restart the rAF loop
    scannerStateRef.current = SCANNER_STATES.SEARCHING;
    setScannerState(SCANNER_STATES.SEARCHING);
    setGuidanceText("Find the document. Point your camera at it.");
    // The rAF loop stopped when we entered DONE_STATES — restart it
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    requestRef.current = requestAnimationFrame(processFrame);
  };

  const handleAccept = async () => {
    setIsUploading(true);
    speakInstruction("Saving document...");
    try {
      const response = await fetch('http://localhost:8080/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileDataUrl: capturedImage })
      });
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      
      if (onConfirm) onConfirm(data.url);
    } catch (err) {
      console.error(err);
      speakInstruction("Upload failed. Please try again.");
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <Script 
        src="https://docs.opencv.org/4.8.0/opencv.js" 
        onReady={handleCvLoaded} 
        strategy="lazyOnload"
      />
      {/* Processing canvas - must NOT be display:none or drawImage returns blank pixels */}
      <canvas ref={canvasRef} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', top: 0, left: 0, width: 1, height: 1 }} />
      
      <div className="p-4 bg-card flex justify-between items-center shadow-sm z-20 relative">
        <h2 className="text-xl font-heading font-bold text-primary">Document Scanner</h2>
        <Button variant="outline" onClick={onCancel} disabled={isUploading}>Cancel</Button>
      </div>

      <div className="relative flex-1 bg-black overflow-hidden flex flex-col items-center justify-center">
        {error ? (
          <div className="text-destructive p-4 text-center bg-card rounded-lg m-4 z-20 relative">
            <p className="font-bold text-xl mb-2">Camera Error</p>
            <p>{error}</p>
          </div>
        ) : scannerState === SCANNER_STATES.RESULT && verificationResult ? (
          <div className="z-20 flex flex-col items-center justify-center h-full w-full bg-background p-6">
            <div className="max-w-md w-full bg-card rounded-2xl shadow-xl overflow-hidden flex flex-col items-center text-center">
              <img src={capturedImage} alt="Captured Document" className="w-full max-h-64 object-contain bg-muted" />
              
              <div className="p-6 w-full">
                {verificationResult.documentMatch && verificationResult.readable ? (
                  <>
                    <h3 className="text-2xl font-bold text-green-600 mb-2">✓ Verified</h3>
                    <p className="text-lg text-foreground mb-6">Appears to be correct and readable.</p>
                    <div className="flex flex-col gap-4">
                      <Button size="lg" onClick={handleAccept} disabled={isUploading} className="w-full text-lg h-14">
                        {isUploading ? "Uploading..." : "Use this document"}
                      </Button>
                      <Button size="lg" variant="outline" onClick={() => handleRetry()} disabled={isUploading} className="w-full text-lg h-14">
                        Scan Again
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-2xl font-bold text-destructive mb-2">✗ Verification Failed</h3>
                    <p className="text-lg text-foreground mb-6">{verificationResult.reason}</p>
                    <Button size="lg" onClick={() => handleRetry()} className="w-full text-lg h-14">
                      Try Again
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              style={{ filter: 'brightness(1.3) contrast(1.1)' }}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity opacity-100`}
            />
            <canvas 
              ref={overlayCanvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity ${DONE_STATES.has(scannerState) ? 'opacity-0' : 'opacity-100'}`}
            />
            
            <div className="absolute bottom-12 left-4 right-4 text-center pointer-events-none z-30">
              <div className="bg-primary/95 text-primary-foreground px-6 py-4 rounded-2xl shadow-2xl inline-block max-w-[90%] mx-auto backdrop-blur-sm border-2 border-primary-foreground/20">
                <p className="text-2xl font-bold font-heading leading-tight">{guidanceText}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
