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
import jsQR from 'jsqr';

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const supported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

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
    if (!open || !supported) return;
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
        const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null;
        const canvas = canvasRef.current ?? document.createElement('canvas');
        canvasRef.current = canvas;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            let value: string | null = null;
            if (detector) {
              value = (await detector.detect(videoRef.current))[0]?.rawValue ?? null;
            } else if (context && videoRef.current.videoWidth > 0) {
              canvas.width = videoRef.current.videoWidth;
              canvas.height = videoRef.current.videoHeight;
              context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              const image = context.getImageData(0, 0, canvas.width, canvas.height);
              value = jsQR(image.data, image.width, image.height)?.data ?? null;
            }
            if (value) {
              onScan(value);
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

  const readImage = async (file: File) => {
    setError(null);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Không đọc được ảnh QR.');
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(image.data, image.width, image.height);
      if (!result?.data) throw new Error('Không tìm thấy mã QR trong ảnh.');
      onScan(result.data);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không đọc được ảnh QR.');
    }
  };

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
                Thiết bị không cho phép camera. Bạn có thể chọn ảnh QR bên dưới.
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
            <canvas ref={canvasRef} className="hidden" />
            <label className="mt-3 flex cursor-pointer items-center justify-center rounded border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
              🖼️ Chọn ảnh QR từ thiết bị
              <input type="file" accept="image/*" className="hidden" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readImage(file);
                event.currentTarget.value = '';
              }} />
            </label>
            <p className="mt-2 text-xs text-neutral-400">
              Đưa mã QR vào khung hình hoặc chọn ảnh QR — link sẽ tự điền khi nhận diện được.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
