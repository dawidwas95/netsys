import { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Printer } from "lucide-react";

interface OrderQRCodeProps {
  orderId: string;
  orderNumber: string;
  clientName?: string | null;
  deviceName?: string | null;
}

export default function OrderQRCode({ orderId, orderNumber, clientName, deviceName }: OrderQRCodeProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  const orderUrl = `${window.location.origin}/orders/${orderId}`;

  useEffect(() => {
    QRCode.toDataURL(orderUrl, { width: 256, margin: 1, errorCorrectionLevel: "M" })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [orderUrl]);

  function handlePrintLabel() {
    const win = window.open("", "_blank", "width=400,height=500");
    if (!win) return;

    const deviceLine = deviceName ? `<p style="margin:2px 0;font-size:12px;color:#555">${deviceName}</p>` : "";

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etykieta ${orderNumber}</title>
        <style>
          @page { size: 62mm 100mm; margin: 0; }
          body {
            margin: 0; padding: 8mm;
            font-family: Arial, Helvetica, sans-serif;
            display: flex; flex-direction: column; align-items: center;
            justify-content: center; height: 100vh;
          }
          .label {
            text-align: center;
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 12px;
            width: 54mm;
          }
          .qr { width: 40mm; height: 40mm; }
          .order-num { font-size: 16px; font-weight: bold; margin: 6px 0 2px; letter-spacing: 0.5px; }
          .client { font-size: 11px; color: #333; margin: 2px 0; }
          .device { font-size: 11px; color: #666; margin: 2px 0; }
          .hint { font-size: 8px; color: #999; margin-top: 4px; }
        </style>
      </head>
      <body>
        <div class="label">
          <img class="qr" src="${qrDataUrl}" alt="QR" />
          <p class="order-num">${orderNumber}</p>
          ${clientName ? `<p class="client">${clientName}</p>` : ""}
          ${deviceLine}
          <p class="hint">Zeskanuj kod, aby otworzyć zlecenie</p>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    win.document.close();
  }

  if (!qrDataUrl) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <QrCode className="h-4 w-4" /> Kod QR zlecenia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div ref={labelRef} className="flex flex-col items-center gap-2 p-3 bg-white rounded-md border border-border">
          <img src={qrDataUrl} alt="QR Code" className="w-32 h-32" />
          <p className="text-sm font-bold font-mono tracking-wide">{orderNumber}</p>
          {clientName && <p className="text-xs text-muted-foreground">{clientName}</p>}
          {deviceName && <p className="text-xs text-muted-foreground">{deviceName}</p>}
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Zeskanuj aby otworzyć zlecenie
        </p>
        <Button variant="outline" size="sm" className="w-full" onClick={handlePrintLabel}>
          <Printer className="mr-1 h-4 w-4" /> Drukuj etykietę
        </Button>
      </CardContent>
    </Card>
  );
}
