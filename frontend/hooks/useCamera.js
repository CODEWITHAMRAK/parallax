import { useState, useCallback, useRef, useEffect } from 'react';

export function useCamera() {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);

  const streamRef = useRef(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });

      if (!isMounted.current) {
        // Component unmounted while waiting for camera permission
        mediaStream.getTracks().forEach(t => t.stop());
        return;
      }

      // Attempt to turn on the flashlight (torch) to improve document detection
      const track = mediaStream.getVideoTracks()[0];
      if (track && track.getCapabilities) {
        try {
          const capabilities = track.getCapabilities();
          if (capabilities.torch) {
            await track.applyConstraints({
              advanced: [{ torch: true }]
            });
          }
        } catch (err) {
          console.warn("Flashlight not supported", err);
        }
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          if (playErr.name !== 'AbortError') {
            console.error("Video play failed", playErr);
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to access camera');
      console.error(err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera(); // Cleanup on unmount
    };
  }, [stopCamera]);

  return { stream, error, videoRef, startCamera, stopCamera };
}
