import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Upload, FileText, Image, Trash2, Download, Eye, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

interface DocumentAttachmentsProps {
  documentId: string | null;
  mode?: "view" | "edit";
  compact?: boolean;
}

interface Attachment {
  id: string;
  document_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  content_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(contentType: string | null) {
  if (contentType?.startsWith("image/")) return <Image className="h-4 w-4 text-primary" />;
  if (contentType === "application/pdf") return <FileText className="h-4 w-4 text-destructive" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

function isPreviewable(contentType: string | null) {
  if (!contentType) return false;
  return contentType.startsWith("image/") || contentType === "application/pdf";
}

export function DocumentAttachments({ documentId, mode = "view", compact = false }: DocumentAttachmentsProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewAtt, setPreviewAtt] = useState<Attachment | null>(null);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["document-attachments", documentId],
    queryFn: async () => {
      if (!documentId) return [];
      const { data, error } = await supabase
        .from("document_attachments")
        .select("*")
        .eq("document_id", documentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Attachment[];
    },
    enabled: !!documentId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (attachment: Attachment) => {
      await supabase.storage.from("document-files").remove([attachment.file_path]);
      const { error } = await supabase.from("document_attachments").delete().eq("id", attachment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document-attachments", documentId] });
      qc.invalidateQueries({ queryKey: ["document-attachment-counts"] });
      toast.success("Plik usunięty");
    },
    onError: (err: any) => toast.error(err?.message || "Błąd usuwania pliku"),
  });

  async function handleUpload(files: FileList | File[] | null) {
    if (!files || !('length' in files) || !files.length || !documentId) return;
    setUploading(true);
    try {
      const fileArray = Array.from(files);
      for (const file of fileArray) {
        const ext = file.name.split(".").pop() || "bin";
        const storagePath = `${documentId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("document-files")
          .upload(storagePath, file, { contentType: file.type });
        if (uploadErr) throw uploadErr;

        const { error: metaErr } = await supabase.from("document_attachments").insert({
          document_id: documentId,
          file_name: file.name,
          file_path: storagePath,
          file_size: file.size,
          content_type: file.type || null,
          uploaded_by: user?.id || null,
        });
        if (metaErr) throw metaErr;
      }
      qc.invalidateQueries({ queryKey: ["document-attachments", documentId] });
      qc.invalidateQueries({ queryKey: ["document-attachment-counts"] });
      toast.success(`Przesłano ${fileArray.length} plik(ów)`);
    } catch (err: any) {
      toast.error(err?.message || "Błąd przesyłania");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files?.length) {
      handleUpload(e.dataTransfer.files);
    }
  }, [documentId]);

  function getPublicUrl(filePath: string) {
    const { data } = supabase.storage.from("document-files").getPublicUrl(filePath);
    return data.publicUrl;
  }

  if (!documentId && mode === "view") return null;

  return (
    <div className="space-y-3">
      {/* Upload area with drag-drop */}
      {documentId && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.tiff,.bmp"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          {uploading ? (
            <div className="flex items-center justify-center gap-2 py-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Przesyłanie...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 py-1">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Przeciągnij pliki tutaj lub <span className="text-primary font-medium">kliknij aby wybrać</span>
              </p>
              <p className="text-[11px] text-muted-foreground">PDF, JPG, PNG, skany dokumentów</p>
            </div>
          )}
        </div>
      )}

      {!documentId && (
        <p className="text-xs text-muted-foreground">Zapisz dokument, aby móc dodać załączniki.</p>
      )}

      {isLoading && <p className="text-xs text-muted-foreground">Ładowanie załączników...</p>}

      {/* File list */}
      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5 text-sm hover:bg-muted/30 transition-colors group">
              {getFileIcon(att.content_type)}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-sm">{att.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(att.file_size)}
                  {att.created_at && ` · ${new Date(att.created_at).toLocaleDateString("pl-PL")}`}
                </p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                {isPreviewable(att.content_type) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Podgląd"
                    onClick={(e) => { e.stopPropagation(); setPreviewAtt(att); }}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Pobierz"
                  asChild
                >
                  <a href={getPublicUrl(att.file_path)} download={att.file_name} onClick={e => e.stopPropagation()}>
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  title="Usuń"
                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(att); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {documentId && !isLoading && attachments.length === 0 && !compact && (
        <p className="text-xs text-muted-foreground">Brak załączników. Przeciągnij plik lub kliknij powyżej aby przesłać fakturę lub skan.</p>
      )}

      {/* Preview Modal */}
      <Dialog open={!!previewAtt} onOpenChange={(v) => { if (!v) setPreviewAtt(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="px-6 py-4 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Paperclip className="h-4 w-4" />
              {previewAtt?.file_name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-0" style={{ height: "75vh" }}>
            {previewAtt?.content_type === "application/pdf" ? (
              <iframe
                src={getPublicUrl(previewAtt.file_path)}
                className="w-full h-full border-0"
                title={previewAtt.file_name}
              />
            ) : previewAtt?.content_type?.startsWith("image/") ? (
              <div className="flex items-center justify-center h-full bg-muted/20 p-4">
                <img
                  src={getPublicUrl(previewAtt.file_path)}
                  alt={previewAtt.file_name}
                  className="max-w-full max-h-full object-contain rounded"
                />
              </div>
            ) : null}
          </div>
          <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-card">
            <p className="text-xs text-muted-foreground">
              {previewAtt && formatFileSize(previewAtt.file_size)}
              {previewAtt?.created_at && ` · ${new Date(previewAtt.created_at).toLocaleDateString("pl-PL")}`}
            </p>
            <div className="flex items-center gap-2">
              {previewAtt && (
                <Button variant="outline" size="sm" asChild>
                  <a href={getPublicUrl(previewAtt.file_path)} download={previewAtt.file_name}>
                    <Download className="h-3.5 w-3.5 mr-1" />Pobierz
                  </a>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => previewAtt && window.open(getPublicUrl(previewAtt.file_path), "_blank")}>
                Otwórz w nowej karcie
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Hook to get attachment counts for multiple documents */
export function useDocumentAttachmentCounts() {
  return useQuery({
    queryKey: ["document-attachment-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_attachments")
        .select("document_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.document_id] = (counts[row.document_id] || 0) + 1;
      }
      return counts;
    },
  });
}
