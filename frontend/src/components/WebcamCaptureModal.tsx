import React, { useCallback, useEffect, useRef, useState } from "react";
import { BiCamera, BiX, BiRefresh } from "react-icons/bi";

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
};

/**
 * Desktop webcam capture: live getUserMedia video + shutter. Captures to a JPEG File so the
 * surrounding upload flow (which expects File objects) doesn't need to change. Mobile routes
 * keep using the native <input capture="environment"> to open the device camera directly.
 */
export const WebcamCaptureModal: React.FC<Props> = ({ open, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Start the webcam stream each time the modal opens; stop everything when it closes.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setPreview(null);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        const msg =
          err?.name === "NotAllowedError"
            ? "Camera access was blocked. Allow access in your browser and try again."
            : err?.name === "NotFoundError"
            ? "No camera found on this device."
            : "Could not start the camera. Check permissions and retry.";
        setError(msg);
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, stopStream]);

  const handleShutter = () => {
    const video = videoRef.current;
    if (!video || !streamRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no-2d-context");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      setPreview(dataUrl);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setError("Could not capture the frame. Try again.");
            setIsCapturing(false);
            return;
          }
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
          onCapture(file);
          stopStream();
          onClose();
          setIsCapturing(false);
        },
        "image/jpeg",
        0.92
      );
    } catch {
      setError("Could not capture the frame. Try again.");
      setIsCapturing(false);
    }
  };

  const handleClose = () => {
    stopStream();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="webcam-modal-overlay" onClick={handleClose}>
      <div className="webcam-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="webcam-modal-header">
          <span className="webcam-modal-title">Take a photo</span>
          <button type="button" className="webcam-modal-close" onClick={handleClose} aria-label="Close">
            <BiX size={22} />
          </button>
        </div>
        <div className="webcam-modal-video-wrap">
          {error ? (
            <div className="webcam-modal-error">
              <p>{error}</p>
              <button
                type="button"
                className="webcam-modal-retry"
                onClick={() => {
                  setError(null);
                  // re-trigger the effect by toggling open via parent isn't available; fall back to reload
                  // the stream directly here.
                  navigator.mediaDevices
                    .getUserMedia({ video: { facingMode: "user" }, audio: false })
                    .then((stream) => {
                      streamRef.current = stream;
                      if (videoRef.current) videoRef.current.srcObject = stream;
                    })
                    .catch(() => setError("Still unable to access the camera."));
                }}
              >
                <BiRefresh size={16} /> Retry
              </button>
            </div>
          ) : preview ? (
            <img src={preview} alt="Captured preview" className="webcam-modal-video" />
          ) : (
            <video ref={videoRef} className="webcam-modal-video" autoPlay playsInline muted />
          )}
        </div>
        <div className="webcam-modal-actions">
          <button type="button" className="webcam-modal-cancel" onClick={handleClose}>
            Cancel
          </button>
          <button
            type="button"
            className="webcam-modal-shutter"
            onClick={handleShutter}
            disabled={!!error || isCapturing}
            aria-label="Take photo"
          >
            <BiCamera size={26} />
          </button>
          <span className="webcam-modal-hint">Press shutter to capture</span>
        </div>
      </div>
      <style>{`
        .webcam-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.72);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          padding: 20px;
        }
        .webcam-modal-card {
          width: min(100%, 640px);
          background: #111;
          color: #fff;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55);
          display: flex;
          flex-direction: column;
        }
        .webcam-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .webcam-modal-title {
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 0.02em;
        }
        .webcam-modal-close {
          background: transparent;
          color: #fff;
          border: none;
          width: 32px;
          height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .webcam-modal-close:hover { background: rgba(255, 255, 255, 0.08); }
        .webcam-modal-video-wrap {
          position: relative;
          aspect-ratio: 16 / 9;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .webcam-modal-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1);
        }
        .webcam-modal-error {
          padding: 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
          color: #ffd6d6;
          font-size: 14px;
          line-height: 1.5;
        }
        .webcam-modal-retry {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--brand-color, #ed0000);
          color: #fff;
          border: none;
          padding: 8px 14px;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
        }
        .webcam-modal-actions {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 16px;
          padding: 16px 20px 20px;
        }
        .webcam-modal-cancel {
          justify-self: start;
          background: transparent;
          color: #e5e5e5;
          border: 1px solid rgba(255, 255, 255, 0.18);
          padding: 8px 16px;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .webcam-modal-cancel:hover { background: rgba(255, 255, 255, 0.08); }
        .webcam-modal-shutter {
          justify-self: center;
          width: 64px;
          height: 64px;
          border-radius: 9999px;
          background: var(--brand-color, #ed0000);
          color: #fff;
          border: 3px solid rgba(255, 255, 255, 0.95);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.5);
        }
        .webcam-modal-shutter:hover:not(:disabled) { transform: scale(1.04); }
        .webcam-modal-shutter:disabled { opacity: 0.5; cursor: not-allowed; }
        .webcam-modal-hint {
          justify-self: end;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.55);
          font-weight: 600;
        }
        @media (max-width: 520px) {
          .webcam-modal-hint { display: none; }
          .webcam-modal-actions { grid-template-columns: 1fr auto 1fr; gap: 8px; }
        }
      `}</style>
    </div>
  );
};
