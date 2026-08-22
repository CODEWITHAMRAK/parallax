"use client";

import React, { useEffect, useState, useRef } from "react";
import { useCamera } from "../../hooks/useCamera";
import { SCANNER_STATES } from "../../lib/scanner/ScannerState";
import { DocumentDetector } from "../../lib/scanner/DocumentDetector";
import { GuidanceEngine } from "../../lib/scanner/GuidanceEngine";
import { ImageProcessor } from "../../lib/scanner/ImageProcessor";
import { Button } from "../ui/button";
import Script from "next/script";
import { useVoice } from "../../hooks/useVoice";

export default function DocumentScanner({ onCancel, onConfirm }) {
  const { videoRef, startCamera, stopCamera, error } = useCamera();
  const [scannerState, setScannerState] = useState(SCANNER_STATES.INITIALIZING_CAMERA);
  const [cvLoaded, setCvLoaded] = useState(false);
  const [guidanceText, setGuidanceText] = useState("Let's scan your document. Please wait while we initialize the camera.");
  
  const { playScannerAudio } = useVoice();

  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  
  const detectorRef = useRef(null);
  const guidanceRef = useRef(new GuidanceEngine());
  const processorRef = useRef(null);
  const requestRef = useRef();
  
  const hasTriggeredCapture = useRef(false);
  const lastProcessTime = useRef(0);
  const targetFPS = 20;
  const fpsInterval = 1000 / targetFPS;
  const scannerStateRef = useRef(SCANNER_STATES.INITIALIZING_CAMERA);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  useEffect(() => {
    if (cvLoaded) {
      scannerStateRef.current = SCANNER_STATES.SEARCHING;
      setScannerState(SCANNER_STATES.SEARCHING);
      setGuidanceText("Find the document. Point your camera at it.");
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      requestRef.current = requestAnimationFrame(processFrame);
    }

    return () => {
      if (detectorRef.current) detectorRef.current.cleanup();
    };
  }, [cvLoaded]);

  const handleCvLoaded = () => {
    const checkCvReady = setInterval(() => {
      if (window.cv && window.cv.Mat) {
        try {
          const m = new window.cv.Mat();
          m.delete();
          clearInterval(checkCvReady);
          detectorRef.current = new DocumentDetector(window.cv);
          processorRef.current = new ImageProcessor(window.cv);
          setCvLoaded(true);
        } catch (e) {}
      }
    }, 100);
  };

  const speakInstruction = (text) => {
    if (text === "Hold still.") {
        if ("vibrate" in navigator) navigator.vibrate(200);
    }
    playScannerAudio(text);
  };

  const DONE_STATES = new Set([SCANNER_STATES.CAPTURING, SCANNER_STATES.PROCESSING]);

  const processFrame = () => {
    const currentState = scannerStateRef.current;
    if (!videoRef.current || !canvasRef.current || !detectorRef.current) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }
    if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }
    if (currentState === SCANNER_STATES.INITIALIZING_CAMERA) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }
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
      geometry = detectorRef.current.detect(video, canvasRef.current);
    } catch(e) {}

    drawOverlay(geometry);

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

  useEffect(() => {
    requestRef.current = requestAnimationFrame(processFrame);
    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  const drawOverlay = (geometry) => {
    const canvas = overlayCanvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;

    const rect   = video.getBoundingClientRect();
    const dw = Math.round(rect.width);
    const dh = Math.round(rect.height);

    if (canvas.width !== dw || canvas.height !== dh) {
      canvas.width  = dw;
      canvas.height = dh;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, dw, dh);

    if (!geometry) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    const videoRatio     = vw / vh;
    const containerRatio = dw / dh;

    let scaledW, scaledH, offX, offY;

    if (containerRatio > videoRatio) {
      scaledW = dw;
      scaledH = dw / videoRatio;
      offX = 0;
      offY = (dh - scaledH) / 2;
    } else {
      scaledH = dh;
      scaledW = dh * videoRatio;
      offX = (dw - scaledW) / 2;
      offY = 0;
    }

    const sx = scaledW / geometry.processWidth;
    const sy = scaledH / geometry.processHeight;
    const corners = geometry.corners;

    ctx.beginPath();
    ctx.moveTo(offX + corners[0].x * sx, offY + corners[0].y * sy);
    for (let i = 1; i < 4; i++) {
      ctx.lineTo(offX + corners[i].x * sx, offY + corners[i].y * sy);
    }
    ctx.closePath();
    ctx.fillStyle   = 'rgba(0, 229, 255, 0.08)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(offX + corners[0].x * sx, offY + corners[0].y * sy);
    for (let i = 1; i < 4; i++) {
      ctx.lineTo(offX + corners[i].x * sx, offY + corners[i].y * sy);
    }
    ctx.closePath();
    ctx.lineWidth   = 3;
    ctx.strokeStyle = '#00e5ff';
    ctx.stroke();

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
    const processed = processorRef.current.process(videoRef.current, geometry);
    if (!processed) {
      speakInstruction("Failed to process image. Try again.");
      hasTriggeredCapture.current = false;
      scannerStateRef.current = SCANNER_STATES.SEARCHING;
      setScannerState(SCANNER_STATES.SEARCHING);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }
    
    if (onConfirm) {
      onConfirm(processed.dataUrl);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <Script 
        src="https://docs.opencv.org/4.8.0/opencv.js" 
        onReady={handleCvLoaded} 
        strategy="lazyOnload"
      />
      <canvas ref={canvasRef} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', top: 0, left: 0, width: 1, height: 1 }} />
      
      <div className="p-4 bg-card flex justify-between items-center shadow-sm z-20 relative">
        <h2 className="text-xl font-heading font-bold text-primary">Document Scanner</h2>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>

      <div className="relative flex-1 bg-black overflow-hidden flex flex-col items-center justify-center">
        {error ? (
          <div className="text-destructive p-4 text-center bg-card rounded-lg m-4 z-20 relative">
            <p className="font-bold text-xl mb-2">Camera Error</p>
            <p>{error}</p>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              style={{ filter: 'brightness(1.3) contrast(1.1)' }}
              className="absolute inset-0 w-full h-full object-cover transition-opacity opacity-100"
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
