import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eraser, Check, Undo2 } from "lucide-react";

interface SignatureCanvasProps {
  title: string;
  existingUrl?: string | null;
  signedAt?: string | null;
  onSave: (dataUrl: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

export default function SignatureCanvas({ title, existingUrl, signedAt, onSave, onClear, disabled }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isEditing, setIsEditing] = useState(!existingUrl);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }, []);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "#1e1e1e";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    if (isEditing) {
      // Small delay to ensure canvas is rendered
      const t = setTimeout(initCanvas, 50);
      return () => clearTimeout(t);
    }
  }, [isEditing, initCanvas]);

  function getPos(e: React.TouchEvent | React.MouseEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }

  function startDraw(e: React.TouchEvent | React.MouseEvent) {
    if (disabled) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    setIsDrawing(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: React.TouchEvent | React.MouseEvent) {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawn(true);
  }

  function endDraw(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    setIsDrawing(false);
  }

  function handleClear() {
    initCanvas();
    setHasDrawn(false);
  }

  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
    setIsEditing(false);
  }

  function handleRemove() {
    onClear();
    setIsEditing(true);
    setHasDrawn(false);
    setTimeout(initCanvas, 50);
  }

  if (!isEditing && existingUrl) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="border border-border rounded-md bg-white p-2">
            <img src={existingUrl} alt={title} className="w-full h-24 object-contain" />
          </div>
          {signedAt && (
            <p className="text-xs text-muted-foreground">
              Podpisano: {new Date(signedAt).toLocaleString("pl-PL")}
            </p>
          )}
          {!disabled && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setIsEditing(true); setTimeout(initCanvas, 50); }}>
                <Undo2 className="mr-1 h-3 w-3" /> Podpisz ponownie
              </Button>
              <Button variant="ghost" size="sm" onClick={handleRemove}>
                <Eraser className="mr-1 h-3 w-3" /> Usuń
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="border border-border rounded-md bg-white touch-none">
          <canvas
            ref={canvasRef}
            className="w-full h-28 cursor-crosshair"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
        </div>
        <p className="text-xs text-muted-foreground">Podpisz palcem lub rysikiem na ekranie dotykowym</p>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={!hasDrawn || disabled}>
            <Check className="mr-1 h-3 w-3" /> Zatwierdź podpis
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear} disabled={disabled}>
            <Eraser className="mr-1 h-3 w-3" /> Wyczyść
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
