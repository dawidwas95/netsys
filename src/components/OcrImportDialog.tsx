import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ScanLine, Upload, Loader2, AlertTriangle, CheckCircle2, FileText, Image,
} from "lucide-react";
import { toast } from "sonner";

export interface OcrExtractedData {
  document_number: string | null;
  document_type: string | null;
  issue_date: string | null;
  sale_date: string | null;
  due_date: string | null;
  contractor_name: string | null;
  contractor_nip: string | null;
  net_amount: number | null;
  vat_amount: number | null;
  gross_amount: number | null;
  payment_method: string | null;
  line_items: Array<{
    name: string;
    quantity: number;
    unit: string;
    unit_net: number;
    vat_rate: number;
    total_gross: number;
  }>;
  confidence: {
    document_number: string;
    dates: string;
    contractor: string;
    amounts: string;
    line_items: string;
  };
  sourceFile: File;
}

interface OcrImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDataExtracted: (data: OcrExtractedData) => void;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-primary/10 text-primary",
  medium: "bg-accent text-accent-foreground",
  low: "bg-destructive/10 text-destructive",
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: "Wysoka",
  medium: "Średnia",
  low: "Niska",
};

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function OcrImportDialog({ open, onOpenChange, onDataExtracted }: OcrImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<OcrExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setProcessing(false);
    setProgress(0);
    setResult(null);
    setError(null);
  }

  async function processFile(file: File) {
    reset();
    setProcessing(true);
    setProgress(10);

    try {
      // Validate file
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new Error("Plik jest zbyt duży. Maksymalny rozmiar to 10 MB.");
      }

      const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/tiff"];
      if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png|webp|heic|tiff?)$/i)) {
        throw new Error("Nieobsługiwany format pliku. Użyj PDF, JPG, PNG lub HEIC.");
      }

      setProgress(30);

      // Convert to base64
      const base64 = await fileToBase64(file);
      setProgress(50);

      // Call edge function
      const { data: fnData, error: fnError } = await supabase.functions.invoke("ocr-invoice", {
        body: {
          image_base64: base64,
          mime_type: file.type || "application/pdf",
        },
      });

      setProgress(90);

      if (fnError) throw new Error(fnError.message || "Błąd przetwarzania OCR");
      if (fnData?.error) throw new Error(fnData.error);

      const extracted = fnData?.data;
      if (!extracted) throw new Error("Brak danych w odpowiedzi OCR");

      const ocrResult: OcrExtractedData = {
        ...extracted,
        line_items: extracted.line_items || [],
        confidence: extracted.confidence || {
          document_number: "low",
          dates: "low",
          contractor: "low",
          amounts: "low",
          line_items: "low",
        },
        sourceFile: file,
      };

      setResult(ocrResult);
      setProgress(100);
    } catch (err: any) {
      setError(err?.message || "Nieznany błąd OCR");
      setProgress(0);
    } finally {
      setProcessing(false);
    }
  }

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList?.length) return;
    processFile(fileList[0]);
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) processFile(e.dataTransfer.files[0]);
  }, []);

  function handleUseData() {
    if (!result) return;
    onDataExtracted(result);
    onOpenChange(false);
    reset();
    toast.success("Dane z OCR zostały wczytane do formularza");
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) reset();
    onOpenChange(isOpen);
  }

  const lowConfidenceFields = result
    ? Object.entries(result.confidence).filter(([, v]) => v === "low" || v === "medium")
    : [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            Import OCR faktury
          </DialogTitle>
          <DialogDescription>
            Prześlij plik PDF lub skan faktury. System automatycznie odczyta dane i wypełni formularz.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.tiff"
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />

        {!result && !processing && !error && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-full p-4 bg-primary/10">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-medium">Przeciągnij fakturę tutaj</p>
                <p className="text-sm text-muted-foreground mt-1">lub wybierz plik z dysku</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <ScanLine className="h-4 w-4 mr-2" />
                Wybierz plik
              </Button>
              <p className="text-xs text-muted-foreground">PDF, JPG, PNG, HEIC — maks. 10 MB</p>
            </div>
          </div>
        )}

        {processing && (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="font-medium">Analizowanie dokumentu...</p>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground">
              {progress < 30 ? "Przygotowywanie pliku..." :
               progress < 60 ? "Wysyłanie do analizy OCR..." :
               progress < 90 ? "Rozpoznawanie tekstu i danych..." :
               "Przetwarzanie wyników..."}
            </p>
          </div>
        )}

        {error && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Błąd OCR</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={reset}>Spróbuj ponownie</Button>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Confidence warnings */}
            {lowConfidenceFields.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Sprawdź dane</AlertTitle>
                <AlertDescription>
                  Niektóre pola wymagają weryfikacji:{" "}
                  {lowConfidenceFields.map(([field]) => {
                    const labels: Record<string, string> = {
                      document_number: "numer dokumentu",
                      dates: "daty",
                      contractor: "kontrahent",
                      amounts: "kwoty",
                      line_items: "pozycje",
                    };
                    return labels[field] || field;
                  }).join(", ")}
                </AlertDescription>
              </Alert>
            )}

            {/* Extracted header */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <DataField
                label="Numer dokumentu"
                value={result.document_number}
                confidence={result.confidence.document_number}
              />
              <DataField
                label="Typ"
                value={
                  result.document_type === "PURCHASE_INVOICE" ? "Faktura zakupowa" :
                  result.document_type === "SALES_INVOICE" ? "Faktura sprzedażowa" :
                  result.document_type === "PROFORMA" ? "Proforma" :
                  result.document_type === "RECEIPT" ? "Paragon" :
                  result.document_type || "—"
                }
                confidence={result.confidence.document_number}
              />
              <DataField label="Data wystawienia" value={result.issue_date} confidence={result.confidence.dates} />
              <DataField label="Termin płatności" value={result.due_date} confidence={result.confidence.dates} />
              <DataField label="Data sprzedaży" value={result.sale_date} confidence={result.confidence.dates} />
              <DataField label="Metoda płatności" value={result.payment_method} confidence="medium" />
            </div>

            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Kontrahent</p>
              <DataField label="Nazwa" value={result.contractor_name} confidence={result.confidence.contractor} />
              <DataField label="NIP" value={result.contractor_nip} confidence={result.confidence.contractor} />
            </div>

            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Kwoty</p>
              <div className="grid grid-cols-3 gap-2">
                <DataField label="Netto" value={result.net_amount != null ? `${result.net_amount.toFixed(2)} zł` : null} confidence={result.confidence.amounts} />
                <DataField label="VAT" value={result.vat_amount != null ? `${result.vat_amount.toFixed(2)} zł` : null} confidence={result.confidence.amounts} />
                <DataField label="Brutto" value={result.gross_amount != null ? `${result.gross_amount.toFixed(2)} zł` : null} confidence={result.confidence.amounts} />
              </div>
            </div>

            {result.line_items.length > 0 && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pozycje ({result.line_items.length})</p>
                  <Badge className={CONFIDENCE_COLORS[result.confidence.line_items]} variant="secondary">
                    {CONFIDENCE_LABELS[result.confidence.line_items]}
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  {result.line_items.slice(0, 10).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm py-1 border-b border-border last:border-0">
                      <span className="truncate flex-1 mr-2">{item.name}</span>
                      <span className="text-muted-foreground whitespace-nowrap">
                        {item.quantity} × {item.unit_net?.toFixed(2)} zł
                      </span>
                    </div>
                  ))}
                  {result.line_items.length > 10 && (
                    <p className="text-xs text-muted-foreground">...i {result.line_items.length - 10} więcej</p>
                  )}
                </div>
              </div>
            )}

            {/* Source file info */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {result.sourceFile.type?.startsWith("image/") ? <Image className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
              <span>{result.sourceFile.name}</span>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-border">
              <Button variant="outline" onClick={reset}>Anuluj</Button>
              <Button onClick={handleUseData}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Użyj tych danych
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DataField({ label, value, confidence }: { label: string; value: string | null | undefined; confidence?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1.5">
        <p className={`text-sm font-medium ${!value ? "text-muted-foreground italic" : ""}`}>
          {value || "nie rozpoznano"}
        </p>
        {value && confidence && confidence !== "high" && (
          <AlertTriangle className={`h-3 w-3 ${confidence === "low" ? "text-destructive" : "text-accent-foreground"}`} />
        )}
      </div>
    </div>
  );
}
