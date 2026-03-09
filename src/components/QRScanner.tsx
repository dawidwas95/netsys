import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff } from "lucide-react";

interface QRScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (value: string) => void;
}

export function QRScanner({ open, onOpenChange, onScan }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = useRef("qr-reader-" + Math.random().toString(36).slice(2));
  const hasScannedRef = useRef(false);

  // Use refs for callbacks to avoid stale closures & unnecessary effect restarts
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const stopScanner = useCallback(async () => {
    if (scannerRef.current?.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch {
        // ignore
      }
    }
    scannerRef.current = null;
    setScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    setError(null);
    hasScannedRef.current = false;

    // Wait for DOM element to be rendered
    await new Promise((r) => setTimeout(r, 400));
    const el = document.getElementById(containerId.current);
    if (!el) return;

    try {
      const scanner = new Html5Qrcode(containerId.current);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          // Guard against double-fire
          if (hasScannedRef.current) return;
          hasScannedRef.current = true;

          // Stop scanner FIRST to prevent re-fires
          if (scannerRef.current?.isScanning) {
            try {
              await scannerRef.current.stop();
            } catch {
              // ignore
            }
          }
          scannerRef.current = null;
          setScanning(false);

          // Close dialog
          onOpenChangeRef.current(false);

          // Then process the scanned value
          onScanRef.current(decodedText);
        },
        () => {
          // ignore scan failures (no code detected yet)
        }
      );
      setScanning(true);
    } catch (err: any) {
      const msg = err?.toString?.() ?? "";
      if (msg.includes("NotAllowedError") || msg.includes("Permission")) {
        setError("Brak dostępu do kamery. Zezwól na dostęp w ustawieniach przeglądarki.");
      } else if (msg.includes("NotFoundError")) {
        setError("Nie znaleziono kamery na tym urządzeniu.");
      } else {
        setError("Nie udało się uruchomić skanera. Sprawdź uprawnienia kamery.");
      }
    }
  }, [stopScanner]);

  useEffect(() => {
    if (open) {
      startScanner();
    }
    return () => {
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
                className="w-full rounded-lg overflow-hidden bg-black aspect-square"
              />
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
