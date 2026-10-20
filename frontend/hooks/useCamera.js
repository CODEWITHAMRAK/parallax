import { useState, useCallback, useRef, useEffect } from 'react';

export function useCamera() {
  const [error, setError] = useState(null);
  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const isMounted   = useRef(true);

  // Track mounted state
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ── Key fix: whenever the stream changes, attach it to the video element.
  // This decouples stream acquisition from video-element availability,
  // which solves the React Strict Mode double-mount black-screen bug.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;

    // CRITICAL FIX: Only set srcObject if it's actually different.
    // Setting it repeatedly on every render causes the video element
    // to restart its pipeline and flicker!
    if (video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current;
      video.play().catch(err => {
        if (err.name !== 'AbortError') console.error('Video play failed:', err);
      });
    }
  });

  const startCamera = useCallback(async () => {
    // Don't start a second stream if one is already running
    if (streamRef.current) return;

    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      if (!isMounted.current) {
        // Component unmounted while waiting for permission
        mediaStream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = mediaStream;

      // Attach to video element immediately if it's already in the DOM
      const video = videoRef.current;
      if (video) {
        video.srcObject = mediaStream;
        video.play().catch(err => {
          if (err.name !== 'AbortError') console.error('Video play failed:', err);
        });
      }
      // If videoRef isn't ready yet, the useEffect above will attach it
      // on the next render.

    } catch (err) {
      if (isMounted.current) {
        setError(err.message || 'Failed to access camera');
        console.error('Camera error:', err);
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => {

        t.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Clean up stream on unmount
  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

  return { error, videoRef, startCamera, stopCamera };
}
