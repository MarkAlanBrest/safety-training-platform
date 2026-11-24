"use client";

import { useEffect, useRef, useState } from "react";

const CAMERA_SLOTS = 2;

function cameraErrorMessage(error: unknown): string {
  if (!(error instanceof DOMException)) return "The webcam could not be started. Check the browser's camera settings.";
  if (error.name === "NotAllowedError" || error.name === "SecurityError") return "Camera access is blocked. Allow camera access for this site in your browser settings, then reload the display.";
  if (error.name === "NotFoundError" || error.name === "OverconstrainedError") return "No webcam was found. Connect a webcam to this computer, then reload the display.";
  if (error.name === "NotReadableError" || error.name === "AbortError") return "The webcam is busy or unavailable. Close other apps using it, or plug it into a different USB port, then reload the display.";
  return "The webcam could not be started. Check that it is connected and camera access is allowed.";
}

/** One live feed bound to a specific camera. */
function CameraFeed({ deviceId, label }: { deviceId: string; label: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState("Starting webcam…");

  useEffect(() => {
    let alive = true;
    let stream: MediaStream | null = null;
    const video = videoRef.current;

    const start = async () => {
      try {
        // Ask for 720p so two USB cameras fit within the USB bandwidth of one computer.
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (!alive) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        if (video) video.srcObject = stream;
        setMessage("");
      } catch (error) {
        if (alive) setMessage(cameraErrorMessage(error));
      }
    };

    void start();
    return () => {
      alive = false;
      stream?.getTracks().forEach(track => track.stop());
      if (video) video.srcObject = null;
    };
  }, [deviceId]);

  return <div className="shop-webcam">
    <video ref={videoRef} autoPlay playsInline muted aria-label={label} />
    {message && <p role="status">{message}</p>}
  </div>;
}

export default function ShopWebcam({ enabled }: { enabled: boolean }) {
  const [deviceIds, setDeviceIds] = useState<string[]>([]);
  const [message, setMessage] = useState("Starting webcams…");

  useEffect(() => {
    if (!enabled) return;
    let alive = true;

    const findCameras = async () => {
      if (!window.isSecureContext) {
        setMessage("Camera access requires a secure HTTPS address or localhost.");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices.enumerateDevices) {
        setMessage("This browser does not support webcam access.");
        return;
      }
      try {
        // Browsers hide camera IDs until permission is granted, so open (and close) one camera first.
        const probe = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        probe.getTracks().forEach(track => track.stop());
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === "videoinput" && device.deviceId).map(device => device.deviceId);
        if (!alive) return;
        setDeviceIds(previous => {
          const next = cameras.slice(0, CAMERA_SLOTS);
          return previous.join("|") === next.join("|") ? previous : next;
        });
        setMessage(cameras.length ? "" : "No webcam was found. Connect a webcam to this computer, then reload the display.");
      } catch (error) {
        if (alive) setMessage(cameraErrorMessage(error));
      }
    };

    void findCameras();
    // Pick up cameras that are plugged in or unplugged while the display is running.
    const onDeviceChange = () => { void findCameras(); };
    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);
    return () => {
      alive = false;
      navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
    };
  }, [enabled]);

  if (!enabled) {
    return <div className="shop-webcam-grid">
      {Array.from({ length: CAMERA_SLOTS }, (_, i) => <div className="shop-webcam-message" key={i}>Live webcam {i + 1} will appear here on the TV display.</div>)}
    </div>;
  }

  if (!deviceIds.length) {
    return <div className="shop-webcam-grid"><div className="shop-webcam-message" role="status">{message}</div></div>;
  }

  return <div className="shop-webcam-grid">
    {Array.from({ length: CAMERA_SLOTS }, (_, i) => deviceIds[i]
      ? <CameraFeed key={deviceIds[i]} deviceId={deviceIds[i]} label={`Live shop webcam ${i + 1}`} />
      : <div className="shop-webcam-message" key={`empty-${i}`}>Plug in a second webcam to show another view of the shop.</div>)}
  </div>;
}
