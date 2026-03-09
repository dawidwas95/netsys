import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface QRScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (value: string) => void;
}

export function QRScanner({ open, onOpenChange, onScan }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = useRef("qr-reader-" + Math.random().toString(36).slice(2));
  const hasScannedRef = useRef(false);
  const mountedRef = useRef(true);

  // Use refs for callbacks to avoid stale closures & unnecessary effect restarts
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch {
        // ignore
      }
      try {
        scannerRef.current.clear();
      } catch {
        // ignore
      }
    }
    scannerRef.current = null;
    if (mountedRef.current) {
      setScanning(false);
      setStarting(false);
    }
  }, []);

  const waitForElement = useCallback(async (id: string, maxWait = 2000): Promise<HTMLElement | null> => {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      const el = document.getElementById(id);
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
        return el;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return document.getElementById(id);
  }, []);

  const startScanner = useCallback(async () => {
    setError(null);
    setStarting(true);
    hasScannedRef.current = false;

    // Wait for DOM element to be rendered and have dimensions
    const el = await waitForElement(containerId.current);
    if (!el) {
      if (mountedRef.current) {
        setError("Nie udało się zainicjalizować skanera.");
        setStarting(false);
      }
      return;
    }

    // Ensure previous instance is cleaned up
    await stopScanner();

    try {
      const scanner = new Html5Qrcode(containerId.current, { verbose: false });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const size = Math.min(viewfinderWidth, viewfinderHeight) * 0.75;
            const s = Math.max(150, Math.floor(size));
            return { width: s, height: s };
          },
          aspectRatio: 1,
        },
        async (decodedText) => {
          // Guard against double-fire
          if (hasScannedRef.current) return;
          hasScannedRef.current = true;

          console.log("[QRScanner] Scanned value:", decodedText);

          // Stop scanner FIRST to prevent re-fires
          if (scannerRef.current) {
            try {
              if (scannerRef.current.isScanning) {
                await scannerRef.current.stop();
              }
              scannerRef.current.clear();
            } catch {
              // ignore
            }
          }
          scannerRef.current = null;

          if (mountedRef.current) {
            setScanning(false);
            setStarting(false);
          }

          // Show feedback toast
          toast.success("Kod zeskanowany", {
            description: decodedText.length > 60 ? decodedText.slice(0, 60) + "…" : decodedText,
            duration: 2000,
          });

          // Close dialog
          onOpenChangeRef.current(false);

          // Process scanned value after a brief delay for UI to settle
          setTimeout(() => {
            onScanRef.current(decodedText);
          }, 100);
        },
        () => {
          // ignore scan failures (no code detected yet)
        }
      );

      if (mountedRef.current) {
        setScanning(true);
        setStarting(false);
      }
    } catch (err: any) {
      console.error("[QRScanner] Start error:", err);
      const msg = err?.toString?.() ?? "";
      if (mountedRef.current) {
        setStarting(false);
        if (msg.includes("NotAllowedError") || msg.includes("Permission")) {
          setError("Brak dostępu do kamery. Zezwól na dostęp w ustawieniach przeglądarki.");
        } else if (msg.includes("NotFoundError") || msg.includes("Requested device not found")) {
          setError("Nie znaleziono kamery na tym urządzeniu.");
        } else if (msg.includes("NotReadableError") || msg.includes("Could not start video source")) {
          setError("Kamera jest używana przez inną aplikację. Zamknij inne aplikacje i spróbuj ponownie.");
        } else {
          setError("Nie udało się uruchomić skanera. Sprawdź uprawnienia kamery.");
        }
      }
    }
  }, [stopScanner, waitForElement]);

  useEffect(() => {
    mountedRef.current = true;
    if (open) {
      startScanner();
    }
    return () => {
      mountedRef.current = false;
      stopScanner();
    };
  }, [open, startScanner, stopScanner]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4" />
            Skanuj kod QR / kreskowy
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-4">
          {error ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CameraOff className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={startScanner}>
                Spróbuj ponownie
              </Button>
            </div>
          ) : (
            <>
              <div
                id={containerId.current}
                className="w-full rounded-lg overflow-hidden bg-black"
                style={{ minHeight: 280 }}
              />
              {starting && !scanning && (
                <div className="flex items-center justify-center gap-2 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Uruchamianie kamery...</p>
                </div>
              )}
              {scanning && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Skieruj kamerę na kod QR lub kreskowy
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
