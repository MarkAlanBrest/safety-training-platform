"use client";

import { useEffect, useRef, useState } from "react";

function cameraErrorMessage(error: unknown): string {
  if (!(error instanceof DOMException)) return "The webcam could not be started. Check the browser's camera settings.";
  if (error.name === "NotAllowedError" || error.name === "SecurityError") return "Camera access is blocked. Allow camera access for this site in your browser settings, then reload the display.";
  if (error.name === "NotFoundError" || error.name === "OverconstrainedError") return "No webcam was found. Connect a webcam to this computer, then reload the display.";
  if (error.name === "NotReadableError" || error.name === "AbortError") return "The webcam is busy or unavailable. Close other apps using it, then reload the display.";
  return "The webcam could not be started. Check that it is connected and camera access is allowed.";
}

export default function ShopWebcam({ enabled }: { enabled: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState("Starting webcam…");

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      if (!window.isSecureContext) {
        setMessage("Camera access requires a secure HTTPS address or localhost.");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setMessage("This browser does not support webcam access.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        if (!alive) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        if (videoRef.current) videoRef.current.srcObject = stream;
        setMessage("");
      } catch (error) {
        if (alive) setMessage(cameraErrorMessage(error));
      }
    };

    void startCamera();
    return () => {
      alive = false;
      stream?.getTracks().forEach(track => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [enabled]);

  if (!enabled) {
    return <div className="shop-webcam-message">The live webcam will appear here on the TV display.</div>;
  }

  return <div className="shop-webcam">
    <video ref={videoRef} autoPlay playsInline muted aria-label="Live shop webcam" />
    {message && <p role="status">{message}</p>}
  </div>;
}
