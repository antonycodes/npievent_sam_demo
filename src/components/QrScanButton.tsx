/**
 * QrScanButton — fill a text field (proxy API URL) by scanning a QR code with
 * the device camera, instead of typing a long link on a phone keyboard.
 *
 * Uses the native `BarcodeDetector` API (no bundled library) — supported on
 * Chrome/Edge/Android WebView, not on desktop Safari/Firefox. Falls back to a
 * message telling the user to type the link manually when unsupported, so the
 * existing text input always keeps working either way.
 */
import { useEffect, useRef, useState } from 'react';

declare global {
  interface DetectedBarcode {
    rawValue: string;
  }
  interface BarcodeDetector {
    detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
  }
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetector;
  }
}

interface QrScanButtonProps {
  /** Called with the decoded QR text (expected to be the proxy URL). */
  onScan: (value: string) => void;
  label?: string;
}

export default function QrScanButton({ onScan, label = '📷 Quét QR' }: QrScanButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const supported = typeof window !== 'undefined' && Boolean(window.BarcodeDetector);

  const stop = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const close = () => {
    stop();
    setOpen(false);
    setError(null);
  };

  useEffect(() => {
    if (!open || !window.BarcodeDetector) return;
    let cancelled = false;
    const Detector = window.BarcodeDetector;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const detector = new Detector({ formats: ['qr_code'] });
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0 && codes[0].rawValue) {
              onScan(codes[0].rawValue);
              close();
              return;
            }
          } catch {
            /* video frame not ready yet — keep polling */
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error && e.name === 'NotAllowedError'
              ? 'Bạn cần cho phép quyền camera để quét QR.'
              : 'Không mở được camera trên thiết bị này.',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-neutral-300 px-2 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
      >
        {label}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-label="Quét mã QR"
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-800">Quét QR link proxy</h3>
              <button
                type="button"
                onClick={close}
                aria-label="Đóng"
                className="text-lg leading-none text-neutral-400 hover:text-neutral-700"
              >
                ×
              </button>
            </div>
            {!supported ? (
              <p className="text-sm text-red-600">
                Trình duyệt này không hỗ trợ quét QR trực tiếp — vui lòng nhập link tay, hoặc mở trang
                bằng Chrome trên Android.
              </p>
            ) : error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : (
              <video
                ref={videoRef}
                className="aspect-square w-full rounded-lg bg-black object-cover"
                muted
                playsInline
              />
            )}
            <p className="mt-2 text-xs text-neutral-400">
              Đưa mã QR vào khung hình — link sẽ tự điền ngay khi nhận diện được.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
