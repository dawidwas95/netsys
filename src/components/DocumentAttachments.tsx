import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Image, Trash2, Download, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DocumentAttachmentsProps {
  documentId: string | null;
  /** In create mode, we buffer files locally until the document is saved */
  mode?: "view" | "edit";
  /** Callback to get buffered files for upload after document creation */
  onBufferedFiles?: (files: File[]) => void;
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
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

export function DocumentAttachments({ documentId, mode = "view" }: DocumentAttachmentsProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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
      // Delete from storage
      await supabase.storage.from("document-files").remove([attachment.file_path]);
      // Delete metadata
      const { error } = await supabase.from("document_attachments").delete().eq("id", attachment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document-attachments", documentId] });
      toast.success("Plik usunięty");
    },
    onError: (err: any) => toast.error(err?.message || "Błąd usuwania pliku"),
  });

  async function handleUpload(files: FileList | null) {
    if (!files || !files.length || !documentId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
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
      toast.success(`Przesłano ${files.length} plik(ów)`);
    } catch (err: any) {
      toast.error(err?.message || "Błąd przesyłania");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function getPublicUrl(filePath: string) {
    const { data } = supabase.storage.from("document-files").getPublicUrl(filePath);
    return data.publicUrl;
  }

  if (!documentId && mode === "view") return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Załączniki</p>
        {documentId && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              {uploading ? "Przesyłanie..." : "Dodaj plik"}
            </Button>
          </div>
        )}
      </div>

      {!documentId && (
        <p className="text-xs text-muted-foreground">Zapisz dokument, aby móc dodać załączniki.</p>
      )}

      {isLoading && <p className="text-xs text-muted-foreground">Ładowanie załączników...</p>}

      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5 text-sm">
              {getFileIcon(att.content_type)}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{att.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(att.file_size)}
                  {att.created_at && ` · ${new Date(att.created_at).toLocaleDateString("pl-PL")}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Otwórz"
                  onClick={() => window.open(getPublicUrl(att.file_path), "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Pobierz"
                  asChild
                >
                  <a href={getPublicUrl(att.file_path)} download={att.file_name}>
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  title="Usuń"
                  onClick={() => deleteMutation.mutate(att)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {documentId && !isLoading && attachments.length === 0 && (
        <p className="text-xs text-muted-foreground">Brak załączników. Kliknij „Dodaj plik" aby przesłać fakturę lub skan.</p>
      )}
    </div>
  );
}
